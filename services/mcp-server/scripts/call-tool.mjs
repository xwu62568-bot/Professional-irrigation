import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const toolName = process.argv[2];
  const rawArgs = process.argv[3] ?? '{}';

  if (!toolName) {
    throw new Error('Usage: node scripts/call-tool.mjs <toolName> [jsonArgs]');
  }

  const toolArgs = JSON.parse(rawArgs);
  const cwd = new URL('..', import.meta.url);
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/index.js'],
    cwd: cwd.pathname,
    env: {
      IRRIGATION_EXECUTION_BASE_URL: required('IRRIGATION_EXECUTION_BASE_URL'),
      IRRIGATION_MCP_EMAIL: process.env.IRRIGATION_MCP_EMAIL ?? '',
      IRRIGATION_MCP_PASSWORD: process.env.IRRIGATION_MCP_PASSWORD ?? '',
      IRRIGATION_MCP_ACCESS_TOKEN: process.env.IRRIGATION_MCP_ACCESS_TOKEN ?? '',
    },
    stderr: 'pipe',
  });

  transport.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  const client = new Client({
    name: 'irrigation-tool-caller',
    version: '0.1.0',
  });

  await client.connect(transport);
  const result = await client.callTool({
    name: toolName,
    arguments: toolArgs,
  });

  console.log(JSON.stringify(result, null, 2));
  await transport.close();
}

main().catch((error) => {
  console.error('[call-tool] failed:', error);
  process.exit(1);
});
