# MCP Server Deployment

Simple Docker Compose deployment for any platform.

## Quick Install

**Linux/Orange Pi:**
```bash
curl -fsSL https://raw.githubusercontent.com/Deejpotter/my-mcp-server/main/install-linux.sh | bash
```

**Windows:**
```cmd
curl -o install.bat https://raw.githubusercontent.com/Deejpotter/my-mcp-server/main/install-windows.bat && install.bat
```

## Manual Steps

### 1. Install Docker
- **Linux:** `curl -fsSL https://get.docker.com | bash`
- **Windows:** Download Docker Desktop

### 2. Deploy Server
```bash
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server

# For ARM devices (Orange Pi, Raspberry Pi)
docker-compose -f docker-compose.orangepi.yml up -d

# For x86 devices
docker-compose up -d
```

### 3. Setup Cloudflare Tunnel
```bash
# Install cloudflared, then:
cloudflared tunnel login
cloudflared tunnel create mcp-server
cloudflared tunnel route dns TUNNEL_ID mcp.yourdomain.com

# Create ~/.cloudflared/config.yml:
tunnel: TUNNEL_ID
credentials-file: ~/.cloudflared/TUNNEL_ID.json
ingress:
  - hostname: mcp.yourdomain.com
    service: http://127.0.0.1:8000
  - service: http_status:404

# Start tunnel
cloudflared service install
sudo systemctl start cloudflared
```

### 4. Configure VS Code
Update `~/.config/Code/User/mcp.json`:
```json
{
  "servers": {
    "my-mcp-server": {
      "type": "fetch",
      "url": "https://mcp.yourdomain.com"
    }
  },
  "inputs": []
}
```

## Commands

```bash
# Start server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop server
docker-compose down

# Update server
git pull && docker-compose up -d --build

# Health check
curl http://localhost:8000/health
```

## Notes

- Server runs on port 8000 locally
- Only `/health` endpoint accepts GET requests
- Root `/` endpoint accepts POST requests for MCP protocol
- ARM devices automatically use resource-limited configuration
- Cloudflare provides SSL and public access