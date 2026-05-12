import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const serverUrl = required('MCP_SERVER_URL');
  const authToken = required('MCP_SERVER_AUTH_TOKEN');

  const client = new Client({
    name: 'irrigation-http-smoke-test',
    version: '0.1.0',
  });

  client.onerror = (error) => {
    console.error('[http-smoke-test] client error:', error);
  };

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  });

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
  console.error('[http-smoke-test] failed:', error);
  process.exit(1);
});
