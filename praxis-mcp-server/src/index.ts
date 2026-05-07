import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
    const app = express();
    app.use(cors({ origin: '*' }));
    
    // Health check endpoint for Railway
    app.get('/health', (_req, _res) => {
      _res.json({ status: 'ok', transport: 'stdio', note: 'stdio mode (HTTP for health only)', timestamp: new Date().toISOString() });
    });

    // For MCP over HTTP, we would need SSE transport here
    // Keeping stdio mode for now - Railway will run as stdio process
    // MCP clients need to connect via local proxy or stdio bridge
    
    app.listen(port, () => {
      console.error(`HTTP server (health check only) listening on port ${port}`);
      console.error('MCP server running in stdio mode');
    });
    
    // Connect stdio transport for MCP
    const transport = new StdioServerTransport();
    console.error('Listening for MCP client on stdio...');
    await server.connect(transport);
  } else {
    const transport = new StdioServerTransport();
    console.error('Listening for MCP client on stdio...');
    await server.connect(transport);
  }
}

main().catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});
