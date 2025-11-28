const { youtubeSearch } = require('./tools/youtube');

/**
 * Registry of MCP tools.
 * Each tool is a function that receives args (object) and returns a result (often JSON-like).
 */
const tools = {
  youtube_search: youtubeSearch
};

/**
 * Call a tool by name with JSON arguments.
 */
async function callTool(name, args) {
  const tool = tools[name];
  if (!tool) {
    throw new Error(`Unknown MCP tool: ${name}`);
  }
  return tool(args);
}

/**
 * Return tool definitions in OpenAI "tools" format for function calling.
 * This is how the LLM knows how to call MCP tools.
 */
function getToolDefinitionsForOpenAI() {
  return [
    {
      type: 'function',
      function: {
        name: 'youtube_search',
        description:
          'Search YouTube videos by keyword and return a list of relevant videos including title, description, URL and channel.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Search query or topic, e.g. "Kubernetes basics" or "DevOps tutorials".'
            },
            maxResults: {
              type: 'integer',
              description:
                'Maximum number of videos to return (default 5, max 10).',
              minimum: 1,
              maximum: 10
            }
          },
          required: ['query']
        }
      }
    }
  ];
}

module.exports = {
  callTool,
  getToolDefinitionsForOpenAI
};
