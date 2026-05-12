import { randomUUID } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { PlatformClient } from './platform-client.js';
import { createServer } from './server.js';
function jsonRpcError(code, message, id = null) {
    return {
        jsonrpc: '2.0',
        error: { code, message },
        id,
    };
}
function parseBearerToken(header) {
    if (!header?.startsWith('Bearer ')) {
        return '';
    }
    return header.slice(7).trim();
}
function summarizeBody(body) {
    if (!body || typeof body !== 'object') {
        return body ?? null;
    }
    const value = body;
    return {
        jsonrpc: value.jsonrpc ?? null,
        method: value.method ?? null,
        id: value.id ?? null,
        paramsKeys: value.params && typeof value.params === 'object'
            ? Object.keys(value.params)
            : [],
        name: value.params &&
            typeof value.params === 'object' &&
            'name' in value.params
            ? value.params.name
            : null,
    };
}
async function main() {
    const config = loadConfig();
    const app = createMcpExpressApp({
        host: config.host,
        allowedHosts: config.allowedHosts && config.allowedHosts.length > 0 ? config.allowedHosts : undefined,
    });
    app.get('/health', (_req, res) => {
        res.status(200).json({
            ok: true,
            service: 'irrigation-mcp-server',
            transport: 'streamable-http',
            executionBaseUrl: config.executionBaseUrl,
        });
    });
    app.use('/mcp', (req, res, next) => {
        if (!config.authToken) {
            return next();
        }
        const token = parseBearerToken(req.headers.authorization);
        if (token !== config.authToken) {
            return res.status(401).json(jsonRpcError(-32001, 'Unauthorized'));
        }
        return next();
    });
    app.post('/mcp', async (req, res) => {
        const requestId = randomUUID();
        const startedAt = Date.now();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });
        const client = new PlatformClient(config);
        const server = createServer(client);
        console.log('[irrigation-mcp-server] incoming request', {
            requestId,
            method: req.method,
            path: req.path,
            contentType: req.headers['content-type'] ?? null,
            origin: req.headers.origin ?? null,
            userAgent: req.headers['user-agent'] ?? null,
            hasAuthorization: Boolean(req.headers.authorization),
            body: summarizeBody(req.body),
        });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
            console.log('[irrigation-mcp-server] request handled', {
                requestId,
                statusCode: res.statusCode,
                durationMs: Date.now() - startedAt,
            });
        }
        catch (error) {
            console.error('[irrigation-mcp-server] http request failed', {
                requestId,
                durationMs: Date.now() - startedAt,
                error,
            });
            if (!res.headersSent) {
                res.status(500).json(jsonRpcError(-32603, 'Internal server error'));
            }
        }
        finally {
            res.on('close', () => {
                transport.close().catch(() => undefined);
                server.close().catch(() => undefined);
            });
        }
    });
    app.get('/mcp', async (_req, res) => {
        res.status(405).json(jsonRpcError(-32000, 'Method not allowed.'));
    });
    app.delete('/mcp', async (_req, res) => {
        res.status(405).json(jsonRpcError(-32000, 'Method not allowed.'));
    });
    app.listen(config.port, config.host, () => {
        console.log(`[irrigation-mcp-server] streamable HTTP listening on ${config.host}:${config.port}`);
    });
}
main().catch((error) => {
    console.error('[irrigation-mcp-server] fatal http error', error);
    process.exit(1);
});
