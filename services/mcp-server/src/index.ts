import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { PlatformClient } from './platform-client.js';
import { createServer } from './server.js';

async function main() {
  const config = loadConfig();
  const client = new PlatformClient(config);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[irrigation-mcp-server] fatal error', error);
  process.exit(1);
});
