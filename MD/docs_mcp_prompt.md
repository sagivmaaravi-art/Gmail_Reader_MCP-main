#### Community

# Docs MCP Server

xAI hosts a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI assistants and agents direct access to the xAI documentation. Instead of copy-pasting docs into a prompt, you can point any MCP-compatible client at the server and let it pull the information it needs.

You can use this with all popular IDEs/Editors of your choice.

**Endpoint:**

```
https://docs.x.ai/api/mcp
```

The server uses the **Streamable HTTP** transport and runs in stateless mode — no session management required.

## Quickstart

### Cursor

In Cursor, go to **Settings → MCP** and add a new server:

* **Type:** `url` (Streamable HTTP)
* **URL:** `https://docs.x.ai/api/mcp`

### Zed

In Zed, go to `agent: open settings` -> Model Context Protocol (MCP) Servers.

Add the following to a new server configuration.

```json
{
    "xai-docs": {
       "url": "https://docs.x.ai/api/mcp"
    }
}
```

### Windsurf

In Windsurf, go to **Settings → MCP** and add a new server using the same endpoint URL.

### OpenCode

In OpenCode Config under `mcp`, add the following config:

```json
{
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
        "xai-docs": {
            "type": "remote",
            "url": "https://docs.x.ai/api/mcp",
            "enabled": true,
        },
    },
}
```

### Any MCP-Compatible Client

Any client that supports the **Streamable HTTP** transport can connect by pointing to the endpoint URL. For example, using the MCP TypeScript SDK:

```javascript customLanguage="javascriptWithoutSDK"
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({ name: 'my-app', version: '1.0.0' });

const transport = new StreamableHTTPClientTransport(
  new URL('https://docs.x.ai/api/mcp'),
);

await client.connect(transport);

// List all available doc pages
const result = await client.callTool({ name: 'list_doc_pages' });
console.log(result);

// Get a specific page
const page = await client.callTool({
  name: 'get_doc_page',
  arguments: { slug: 'developers/quickstart' },
});
console.log(page);
```

### Using curl

You can also interact with the MCP server directly via HTTP. The server accepts JSON-RPC requests:

```bash customLanguage="bash"
# Initialize (optional — the server is stateless)
curl -X POST https://docs.x.ai/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "capabilities": {},
      "clientInfo": { "name": "curl", "version": "1.0.0" },
      "protocolVersion": "2025-03-26"
    },
    "id": 1
  }'

# List available tools
curl -X POST https://docs.x.ai/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }'

# Call a tool
curl -X POST https://docs.x.ai/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_docs",
      "arguments": { "query": "rate limits", "max_results": 3 }
    },
    "id": 3
  }'
```
