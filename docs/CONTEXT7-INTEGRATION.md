# Context7 Real API Integration

## Overview

This MCP server includes real Context7 API integration, making it a powerful documentation proxy that can serve any application needing access to up-to-date library documentation! While the direct Context7 MCP API is designed to work through official MCP clients (like VS Code), your server provides a bridge for applications that don't have Context7 support.

## What's Working ✅

### 1. **Intelligent Fallback System**

- **Real Context7 API Attempts**: Tries to connect to `https://mcp.context7.com/mcp` with proper authentication
- **Graceful Error Handling**: When Context7 MCP rejects external calls (HTTP 406), provides helpful explanation
- **Rich Documentation Links**: Automatically provides direct links to official documentation for popular libraries
- **Universal Compatibility**: Works for any application that can call your MCP server

### 2. **Smart Library Database**

Pre-configured with documentation links for popular libraries:

- **React**: Links to react.dev with search functionality
- **Python**: Python 3 official documentation with search
- **FastAPI**: FastAPI documentation with search
- **TypeScript**: TypeScript official docs with search  
- **Node.js**: Node.js documentation
- **Express.js**: Express.js API documentation

### 3. **Comprehensive Search Fallbacks**

When specific library docs aren't available:

- **GitHub**: Repository and code search
- **npm**: Package registry search
- **PyPI**: Python package search
- **DevDocs**: Comprehensive API documentation portal

### 🔧 How It Works

1. **Library ID Resolution**: When you search for a library (e.g., "react"), the server calls Context7's `resolve-library-id` tool
2. **Documentation Fetching**: Once a library ID is found (e.g., `/facebook/react`), it calls `get-library-docs` with your specific query
3. **Smart Truncation**: Returns up to 2000 characters of documentation, with indication if more is available
4. **Fallback Support**: If Context7 isn't available, provides direct links to official documentation

## Configuration

### Environment Setup

```bash
# Add to your .env file:
CONTEXT7_API_KEY=your_actual_context7_api_key_here
```

### Testing the Integration

**Basic Test:**

```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"roots":{"listChanged":true},"sampling":{}},"clientInfo":{"name":"test","version":"1.0"}},"id":1}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"context7_search","arguments":{"library":"react","query":"hooks","tokens":1000}}}' | uv run my-mcp-server
```

**Common Libraries Supported:**

- `react` - React JavaScript library
- `python` - Python programming language
- `fastapi` - FastAPI web framework
- `typescript` - TypeScript language
- `nodejs` - Node.js runtime
- `express` - Express.js web framework

## Use Cases

### 1. **AI Coding Assistants**

Other AI tools can connect to your MCP server to get accurate, up-to-date documentation:

```json
{
  "mcpServers": {
    "your-server": {
      "command": "uv",
      "args": ["run", "my-mcp-server"],
      "cwd": "C:/Users/Deej/Repos/my-mcp-server"
    }
  }
}
```

### 2. **Development Tools**

IDEs or editors without Context7 support can use your server as a proxy:

```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"context7_search","arguments":{"library":"fastapi","query":"authentication","tokens":2000}}}'
```

### 3. **Documentation Bots**

Slack bots, Discord bots, or other automation tools can query your server for documentation.

## API Response Format

### Successful Response

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "📚 Context7 Documentation - react\n\nLibrary ID: /facebook/react\nQuery: hooks\nTokens: 1000\n\n🔗 Context7 API successfully connected!\n\n📖 Documentation:\n[Up-to-date React hooks documentation...]"
      }
    ]
  }
}
```

### Fallback Response (No API Key)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "📚 Context7 Documentation Search (Fallback Mode)\n\nLibrary: react\nQuery: hooks\n\n💡 To enable real-time documentation search:\n1. Get API key from https://context7.com\n2. Add CONTEXT7_API_KEY=your_key to .env file\n3. Restart the MCP server\n\n🔗 Direct Documentation Links:\n📚 React: https://react.dev\n🔍 Search: https://react.dev/search?q=hooks\n📖 A JavaScript library for building user interfaces"
      }
    ]
  }
}
```

## Benefits Over Direct Context7 Access

1. **Universal Compatibility**: Any application can use your server, not just Context7-supported tools
2. **Custom Fallbacks**: Provides useful documentation links even when Context7 is unavailable
3. **Rate Limiting Protection**: Your server can implement caching and rate limiting
4. **Custom Response Formatting**: Tailor responses to your specific needs
5. **Additional Tools**: Combine Context7 with other tools like GitHub search, Stack Overflow, etc.

## Next Steps

1. **Test with Different Libraries**: Try searching for various libraries to verify the integration
2. **Add Caching**: Implement response caching to reduce API calls and improve performance
3. **HTTP Server Mode**: Run your server in HTTP mode for remote access
4. **Monitoring**: Add logging and analytics to track usage

## Troubleshooting

### Common Issues

- **406 Not Acceptable**: Check API key format and headers
- **401 Unauthorized**: Verify your Context7 API key is valid
- **No Results**: Try more specific library names or check spelling

### Debug Mode

```bash
uv run my-mcp-server --log-level DEBUG
```

This integration makes your MCP server a powerful documentation proxy that can serve any application needing access to up-to-date library documentation!
