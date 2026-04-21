import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTools } from './tools/index.js';

async function main() {
  const server = createTools();
  const transport = new StdioServerTransport();
  
  console.error('Praxis MCP server starting...');
  console.error('API URL:', process.env.PRAXIS_API_URL || 'https://web-production-646a4.up.railway.app/api');
  console.error('Listening for MCP client on stdio...');
  
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});