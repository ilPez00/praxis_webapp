import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { createTools } from './tools/index.js';
import express from 'express';
import cors from 'cors';

async function main() {
  const server = createTools();
  const transportType = process.env.TRANSPORT || 'stdio';
  const port = parseInt(process.env.PORT || '3456', 10);

  const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
  const hasApiKey = !!process.env.PRAXIS_API_KEY;

  console.error('Praxis MCP server starting...');
  console.error('API URL:', process.env.PRAXIS_API_URL || 'https://web-production-646a4.up.railway.app/api');
  console.error('Auth:', (hasApiKey ? 'API key configured' : 'no API key') + ', ' + (hasSupabase ? 'Supabase configured (login/OAuth enabled)' : 'no Supabase (login/OAuth disabled)'));
  console.error('Transport:', transportType);

  if (transportType === 'http') {
    // HTTP mode for Railway — use createMcpExpressApp
    const mcpApp = createMcpExpressApp({ host: '0.0.0.0' });

    // Add CORS
    mcpApp.use(cors({ origin: '*' }));

    // Health check endpoint for Railway
    mcpApp.get('/health', (_req, res) => {
      res.json({ status: 'ok', transport: 'http', timestamp: new Date().toISOString() });
    });

    mcpApp.listen(port, () => {
      console.error(`MCP HTTP server listening on port ${port}`);
    });
  } else {
    // stdio mode for local Claude Desktop / Cursor
    const transport = new StdioServerTransport();
    console.error('Listening for MCP client on stdio...');
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});
