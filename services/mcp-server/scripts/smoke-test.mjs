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

  const client = new Client({
    name: 'irrigation-smoke-test',
    version: '0.1.0',
  });

  transport.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  client.onerror = (error) => {
    console.error('[smoke-test] client error:', error);
  };

  await client.connect(transport);

  const tools = await client.listTools();
  console.log('TOOLS');
  console.log(JSON.stringify(tools.tools.map((tool) => tool.name), null, 2));

  const overview = await client.callTool({
    name: 'get_overview',
    arguments: {},
  });
  console.log('GET_OVERVIEW');
  console.log(JSON.stringify(overview, null, 2));

  const plans = await client.callTool({
    name: 'list_plans',
    arguments: {},
  });
  console.log('LIST_PLANS');
  console.log(JSON.stringify(plans, null, 2));

  await transport.close();
}

main().catch((error) => {
  console.error('[smoke-test] failed:', error);
  process.exit(1);
});
