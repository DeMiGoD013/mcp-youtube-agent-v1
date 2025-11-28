// ---------------------------------------------
// Imports
// ---------------------------------------------
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

const { google } = require('googleapis');
const { oauth2Client, saveTokens } = require('./youtube/oauth');
const { getToolDefinitionsForOpenAI, callTool } = require('./mcp/mcpServer');
const ytRoutes = require('./youtube/routes');

// ---------------------------------------------
// App Setup
// ---------------------------------------------
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || '*'
  })
);

// ---------------------------------------------
// Session (only used for temporary login, not storage)
// ---------------------------------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'yt_secret_default',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
);

// ---------------------------------------------
// Health Check
// ---------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-youtube-agent-server'
  });
});

// ---------------------------------------------
// YouTube OAuth Login
// ---------------------------------------------
app.get('/auth/youtube', (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/youtube"
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes
  });

  res.redirect(url);
});

// ---------------------------------------------
// OAuth Callback (Saves Tokens Permanently)
// ---------------------------------------------
app.get('/auth/youtube/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing authorization code.");

    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens to persistent file
    saveTokens(tokens);

    // Set credentials for active usage
    oauth2Client.setCredentials(tokens);

    res.send(`
      <h2>🎉 YouTube Authentication Successful</h2>
      <p>You may now close this window.</p>
    `);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("Authentication failed");
  }
});

// ---------------------------------------------
// YouTube Feature Routes (Like, Watch Later, etc.)
// ---------------------------------------------
app.use('/api/youtube', ytRoutes);

// ---------------------------------------------
// MAIN MCP Chat Endpoint
// ---------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage || typeof userMessage !== 'string') {
      return res.status(400).json({ error: 'message is required and must be a string' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY is not configured on the server'
      });
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const systemPrompt = `
You are an AI YouTube agent connected to an MCP server.

Your goals:
- Provide helpful, structured responses.
- ALWAYS use Markdown formatting.
- ALWAYS call youtube_search tool for YouTube queries.
- Keep responses short and readable.
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const tools = getToolDefinitionsForOpenAI();

    const firstResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages,
        tools,
        tool_choice: 'auto'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const firstMessage = firstResponse.data.choices[0].message;

    let aggregatedVideos = [];
    let finalAssistantMessage = firstMessage;

    if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
      const toolMessages = [];

      for (const toolCall of firstMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

        const toolResult = await callTool(toolName, toolArgs);

        if (toolName === 'youtube_search') {
          aggregatedVideos = toolResult;
        }

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: JSON.stringify(toolResult)
        });
      }

      const secondResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages: [...messages, firstMessage, ...toolMessages]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      finalAssistantMessage = secondResponse.data.choices[0].message;
    }

    return res.json({
      reply: finalAssistantMessage.content,
      videos: aggregatedVideos
    });
  } catch (err) {
    console.error('Error in /api/chat:', err?.response?.data || err.message || err);
    return res.status(500).json({
      error: 'Internal server error',
      details: err?.response?.data || err.message
    });
  }
});

// ---------------------------------------------
// Start Server
// ---------------------------------------------
app.listen(PORT, () => {
  console.log(`MCP YouTube Agent server running on port ${PORT}`);
});
