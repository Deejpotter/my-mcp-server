# Advanced Configuration & Deployment

This document covers advanced topics for the MCP Server including remote deployment, API integrations, security, and troubleshooting.

## 🚀 Remote Deployment

### Docker Deployment

**Standard x86 Deployment:**

```bash
docker-compose up -d
```

**ARM Devices (Raspberry Pi, Orange Pi):**

```bash
docker-compose -f docker-compose.orangepi.yml up -d
```

### Cloudflare Tunnel Setup

For secure public access without port forwarding:

1. **Install Cloudflared:**

```bash
# Linux
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Windows
winget install --id Cloudflare.cloudflared
```

2. **Authenticate and Create Tunnel:**

```bash
cloudflared tunnel login
cloudflared tunnel create mcp-server
cloudflared tunnel route dns TUNNEL_ID mcp.yourdomain.com
```

3. **Configure Tunnel:**
Create `~/.cloudflared/config.yml`:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: ~/.cloudflared/YOUR_TUNNEL_ID.json
ingress:
  - hostname: mcp.yourdomain.com
    service: http://127.0.0.1:8000
  - service: http_status:404
```

4. **Start Tunnel Service:**

```bash
cloudflared service install
sudo systemctl start cloudflared
```

### Environment Variables for Production

Create a production `.env` file:

```env
# Required for remote access
MY_SERVER_API_KEY=your_secure_64_char_api_key_here

# Optional integrations
GITHUB_TOKEN=ghp_your_github_personal_access_token
CLICKUP_API_TOKEN=pk_your_clickup_api_token
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_bookstack_token_id
BOOKSTACK_TOKEN_SECRET=your_bookstack_token_secret
```

## 🔐 Authentication & Security

### API Key Authentication

The server supports API key authentication for remote access:

**Generating API Keys:**

```bash
# Generate a secure API key
python -c "import secrets; print(secrets.token_hex(32))"
```

**Using API Keys:**

- **X-API-Key Header:** `X-API-Key: your_api_key_here`
- **Authorization Header:** `Authorization: Bearer your_api_key_here`

### VS Code Configuration with Authentication

For remote servers with authentication:

```json
{
  "mcpServers": {
    "my-mcp-server-remote": {
      "type": "fetch",
      "url": "https://mcp.yourdomain.com",
      "headers": {
        "X-API-Key": "your_api_key_here"
      }
    }
  }
}
```

### Security Best Practices

1. **Use Strong API Keys:** 64-character random hex strings
2. **Environment Variables:** Never hardcode secrets in source code
3. **HTTPS Only:** Always use Cloudflare or proper SSL certificates
4. **Regular Rotation:** Update API keys periodically
5. **Minimal Permissions:** Use read-only tokens where possible

## 🔗 API Integrations

### GitHub Integration

**Setup:**

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Create token with `public_repo` scope
3. Add to `.env`: `GITHUB_TOKEN=ghp_your_token_here`

**Benefits:**

- Higher rate limits (5000/hour vs 60/hour)
- Access to private repositories (if needed)
- Enhanced search capabilities

### ClickUp Integration

**Setup:**

1. Go to [ClickUp Settings > Apps](https://app.clickup.com/settings/apps)
2. Create new API token
3. Add to `.env`: `CLICKUP_API_TOKEN=pk_your_token_here`

**Finding IDs:**

- **List ID:** From URL `https://app.clickup.com/123456/v/li/987654321` → `987654321`
- **Workspace ID:** From API or workspace settings

**Available Tools:**

- `clickup_get_workspaces` - List all workspaces
- `clickup_get_tasks` - Get tasks from specific list
- `clickup_create_task` - Create new tasks

### BookStack Integration

**Setup:**

1. Go to BookStack Settings > API Tokens
2. Create new token with appropriate permissions
3. Add to `.env`:

   ```env
   BOOKSTACK_URL=https://your-bookstack.com
   BOOKSTACK_TOKEN_ID=your_token_id
   BOOKSTACK_TOKEN_SECRET=your_token_secret
   ```

**Available Tools:**

- `bookstack_search` - Search pages, books, chapters
- `bookstack_get_page` - Get specific page content
- `bookstack_create_page` - Create new pages

## 📚 Documentation Search

### Context7 Integration

Advanced documentation search with AI-powered context:

**Features:**

- Library-specific documentation
- Contextual code examples
- Intelligent result ranking

**Usage:**

- `context7_search` - Search specific library documentation
- Fallbacks to official docs when API unavailable

### Multi-Source Documentation Search

**Available Sources:**

- **Stack Overflow:** Community Q&A and solutions
- **GitHub:** Repository documentation and READMEs
- **MDN Web Docs:** Authoritative web development docs
- **DevDocs.io:** Comprehensive API references

**Search Strategy:**

1. Use `search_docs_online` for broad research
2. Use `github_search_code` for implementation examples
3. Use `devdocs_search` for quick API reference
4. Use `context7_search` for library-specific deep dives

## 🛠️ Development & Customization

### Adding Custom Tools

1. **Define Tool Schema:**

```python
Tool(
    name="your_tool_name",
    description="Clear description of what the tool does",
    inputSchema={
        "type": "object",
        "properties": {
            "param1": {"type": "string", "description": "Parameter description"},
            "param2": {"type": "integer", "default": 10}
        },
        "required": ["param1"]
    }
)
```

2. **Implement Tool Handler:**

```python
elif name == "your_tool_name":
    param1 = arguments.get("param1", "")
    param2 = arguments.get("param2", 10)
    
    try:
        result = your_custom_function(param1, param2)
        return [types.TextContent(type="text", text=f"Result: {result}")]
    except Exception as e:
        return [types.TextContent(type="text", text=f"Error: {str(e)}")]
```

### Custom Resource Integration

Add custom data sources:

1. **Add Resource Definition:**

```python
Resource(
    uri="custom://your_resource",
    name="Your Resource Name",
    description="Description of your resource",
    mimeType="application/json"
)
```

2. **Implement Resource Handler:**

```python
elif uri == "custom://your_resource":
    data = fetch_your_custom_data()
    return json.dumps(data, indent=2)
```

### Environment-Specific Configuration

**Development:**

```bash
python main.py --transport stdio --log-level DEBUG
```

**Production:**

```bash
python main.py --transport http --host 0.0.0.0 --port 8000 --log-level INFO
```

**Docker Production:**

```yaml
environment:
  - LOG_LEVEL=INFO
  - MY_SERVER_API_KEY=${MY_SERVER_API_KEY}
```

## 🔧 Troubleshooting

### Common Issues

**Connection Problems:**

- Check firewall settings for port 8000
- Verify API key configuration
- Ensure server is running: `curl http://localhost:8000/health`

**Authentication Errors:**

- Verify API key is correctly set in environment
- Check header format: `X-API-Key: your_key`
- Ensure `.env` file is loaded

**Docker Issues:**

- Check logs: `docker-compose logs -f`
- Verify compose file architecture (ARM vs x86)
- Ensure port 8000 is available

**VS Code Integration:**

- Verify MCP configuration path
- Check VS Code logs for connection errors
- Ensure server path is absolute

### Debug Commands

**Test Server Health:**

```bash
curl http://localhost:8000/health
```

**Test Authentication:**

```bash
curl -H "X-API-Key: your_key" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  http://localhost:8000/
```

**View Server Logs:**

```bash
# Docker
docker-compose logs -f

# Direct Python
python main.py --log-level DEBUG
```

### Performance Optimization

**Rate Limiting Considerations:**

- GitHub API: Use token for higher limits
- Stack Overflow: Implement request caching
- Context7: Monitor token usage

**Resource Management:**

- Set appropriate file size limits
- Configure command timeouts
- Monitor memory usage in Docker

## 📊 Monitoring & Maintenance

### Health Checks

The server provides health endpoints for monitoring:

```bash
# Basic health check
curl http://localhost:8000/health

# Expected response
{
  "status": "healthy",
  "server": "my-mcp-server",
  "tools_count": 17,
  "authentication": "enabled",
  "api_key_required": true
}
```

### Updates and Maintenance

**Update Deployment:**

```bash
cd ~/mcp-server
git pull
docker-compose up -d --build
```

**Backup Configuration:**

```bash
# Backup environment and config
cp .env .env.backup
cp docker-compose.yml docker-compose.yml.backup
```

### Log Management

**Log Rotation (Linux):**

```bash
# Add to /etc/logrotate.d/mcp-server
/var/log/mcp-server/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

## 🆘 Support

### Useful Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [VS Code MCP Extension Guide](https://code.visualstudio.com/docs/editor/mcp)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

### Reporting Issues

When reporting issues, include:

1. Server logs (`docker-compose logs` or direct Python output)
2. Configuration files (sanitized of API keys)
3. System information (OS, Docker version, Python version)
4. Steps to reproduce the issue

---

For basic setup and usage, see [README.md](README.md).
