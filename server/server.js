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
const FRONTEND_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const REDIRECT_URI = process.env.REDIRECT_URI;   // <--- important for Render


app.use(express.json());

// CORS (Render + Vercel safe)
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


// ---------------------------------------------
// Session (only used for temporary OAuth)
// ---------------------------------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET || "yt_secret_default",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      httpOnly: true,
      sameSite: "lax",
    },
  })
);


// ---------------------------------------------
// Health Check (Render uses /health)
// ---------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-youtube-agent-server',
    env: process.env.NODE_ENV || "local"
  });
});

app.get("/", (req, res) => {
  res.send("MCP YouTube Agent Backend Running");
});


// ---------------------------------------------
// YouTube OAuth Login (Dynamic Redirect URI)
// ---------------------------------------------
app.get('/auth/youtube', (req, res) => {
  try {
    const scopes = [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/youtube"
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      redirect_uri: REDIRECT_URI   // <--- important
    });

    return res.redirect(authUrl);

  } catch (err) {
    console.error("OAuth URL generation error:", err);
    res.status(500).send("OAuth initialization failed.");
  }
});


// ---------------------------------------------
// OAuth Callback (Render compatible)
// ---------------------------------------------
app.get('/auth/youtube/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing authorization code.");

    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: REDIRECT_URI,  // <--- crucial
    });

    // Save tokens permanently
    saveTokens(tokens);
    oauth2Client.setCredentials(tokens);

    res.send(`
      <h2>🎉 YouTube Authentication Successful</h2>
      <p>You may now close this window.</p>
    `);

  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err.message);
    res.status(500).send("Authentication failed.");
  }
});


// ---------------------------------------------
// OAuth Status (Check if logged in)
// ---------------------------------------------
app.get("/auth/status", (req, res) => {
  const isAuthenticated = !!oauth2Client.credentials?.access_token;

  return res.json({
    authenticated: isAuthenticated,
    tokens: isAuthenticated ? "Available" : "Not Available",
  });
});


// ---------------------------------------------
// YouTube Feature Routes
// ---------------------------------------------
app.use('/api/youtube', ytRoutes);


// ---------------------------------------------
// MAIN MCP Chat Endpoint
// ---------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing" });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const systemPrompt = `
You are an AI YouTube agent connected to an MCP server.
- ALWAYS use markdown
- ALWAYS trigger youtube_search tool for YouTube queries
- Keep answers simple, helpful, readable
    `;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];

    const tools = getToolDefinitionsForOpenAI();

    // -------- First OpenAI call (tool selection)
    const ai1 = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model,
        messages,
        tools,
        tool_choice: "auto",
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const firstMsg = ai1.data.choices[0].message;

    let toolResults = [];
    let toolMessages = [];

    if (firstMsg.tool_calls?.length > 0) {
      for (const tool of firstMsg.tool_calls) {
        const args = JSON.parse(tool.function.arguments || "{}");
        const result = await callTool(tool.function.name, args);

        if (tool.function.name === "youtube_search") {
          toolResults = result;
        }

        toolMessages.push({
          role: "tool",
          tool_call_id: tool.id,
          name: tool.function.name,
          content: JSON.stringify(result),
        });
      }

      // -------- Second OpenAI call (final answer)
      const ai2 = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [...messages, firstMsg, ...toolMessages],
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return res.json({
        reply: ai2.data.choices[0].message.content,
        videos: toolResults,
      });
    }

    // No tool used
    return res.json({
      reply: firstMsg.content,
      videos: [],
    });

  } catch (err) {
    console.error("Error in /api/chat:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Internal server error",
      details: err.response?.data || err.message,
    });
  }
});


// ---------------------------------------------
// Start Server
// ---------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ MCP YouTube Agent running on port ${PORT}`);
  console.log(`🔗 OAuth Redirect URI: ${REDIRECT_URI}`);
  console.log(`🌍 Allowed Origin: ${FRONTEND_ORIGIN}`);
});
