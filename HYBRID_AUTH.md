# Hybrid Authentication Setup Guide

## 🔗 **The Problem & Solution**

**Problem**:

- **Browser access**: Works great with Cloudflare Access + Google OAuth
- **CLI/Copilot access**: Can't do OAuth flow, needs API keys

**Solution**: Dual authentication paths on the same server!

## 🛠️ **Implementation Strategy**

### **Path 1: Browser Access (Cloudflare Access)**

```
Browser → Cloudflare Access → Google OAuth → Your Server
Headers: Cf-Access-Authenticated-User-Email: you@domain.com
```

### **Path 2: CLI/Copilot Access (API Key Bypass)**

```
CLI/Copilot → Direct to Server → API Key Auth → Your Server  
Headers: X-MCP-Copilot-Key: your-copilot-key
```

## ⚙️ **Cloudflare Configuration**

### **Step 1: Configure Cloudflare Access**

In your Cloudflare tunnel config, add **bypass rules**:

```yaml
# ~/.cloudflared/config.yml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # Main MCP server with Access protection
  - hostname: mcp.deejpotter.com
    service: http://127.0.0.1:8000
    originRequest:
      access:
        required: true
        
  # API bypass endpoint (no Cloudflare Access)
  - hostname: api.mcp.deejpotter.com
    service: http://127.0.0.1:8000
    originRequest:
      access:
        required: false
        
  - service: http_status:404
```

### **Step 2: Cloudflare Access Policy**

1. **Go to**: Cloudflare Dashboard → Zero Trust → Access → Applications
2. **Create Application**:
   - **Name**: MCP Server
   - **Domain**: `mcp.deejpotter.com`
   - **Type**: Self-hosted
3. **Add Policy**:
   - **Name**: Personal Access
   - **Action**: Allow
   - **Include**: Your Google email
   - **Require**: (optional) Country, IP range, etc.

### **Step 3: DNS Records**

Add both domains:

```bash
# Main domain (with Access)
mcp.deejpotter.com → CNAME → your-tunnel-id.cfargotunnel.com

# API domain (bypass Access)  
api.mcp.deejpotter.com → CNAME → your-tunnel-id.cfargotunnel.com
```

## 🔑 **API Key Setup**

### **Generate Keys**

```bash
# Generate specific keys for different use cases
python -c "import secrets; print('Copilot Key:', secrets.token_urlsafe(32))"
python -c "import secrets; print('CLI Key:', secrets.token_urlsafe(32))"
python -c "import secrets; print('Personal Key:', secrets.token_urlsafe(32))"
```

### **Environment Variables**

```bash
# Set these in your server environment
export MCP_COPILOT_KEY="your-copilot-key-here"
export MCP_CLI_KEY="your-cli-key-here"  
export MCP_PERSONAL_KEY="your-personal-key-here"
```

## 📱 **Client Configuration**

### **VS Code/GitHub Copilot Configuration**

```json
{
  "mcp": {
    "mcpServers": {
      "my-hybrid-mcp-server": {
        "transport": {
          "type": "http",
          "uri": "https://api.mcp.deejpotter.com",
          "headers": {
            "X-MCP-Copilot-Key": "your-copilot-key-here"
          }
        }
      }
    }
  }
}
```

### **CLI Access**

```bash
# Using curl with API key
curl -H "X-MCP-CLI-Key: your-cli-key" https://api.mcp.deejpotter.com/health

# Using httpie
http GET api.mcp.deejpotter.com/health X-MCP-CLI-Key:your-cli-key

# Python client
import requests
headers = {"X-MCP-CLI-Key": "your-cli-key"}
response = requests.get("https://api.mcp.deejpotter.com/health", headers=headers)
```

### **Browser Access**

```bash
# Just visit in browser - will redirect to Google OAuth
https://mcp.deejpotter.com
```

## 🔄 **Authentication Flow Examples**

### **Scenario 1: You in Browser**

1. Visit `https://mcp.deejpotter.com`
2. Cloudflare redirects to Google OAuth
3. After login, Cloudflare sets header: `Cf-Access-Authenticated-User-Email: you@gmail.com`
4. Server sees OAuth header, grants full access

### **Scenario 2: GitHub Copilot**

1. VS Code sends request to `https://api.mcp.deejpotter.com`
2. Includes header: `X-MCP-Copilot-Key: your-copilot-key`
3. Bypasses Cloudflare Access (direct to server)
4. Server validates API key, grants access

### **Scenario 3: CLI Tool**

1. Script sends request to `https://api.mcp.deejpotter.com`
2. Includes header: `X-MCP-CLI-Key: your-cli-key`
3. Bypasses Cloudflare Access
4. Server validates API key, grants access

### **Scenario 4: Someone Else**

1. Visits `https://mcp.deejpotter.com`
2. Cloudflare Access blocks them (not on allow list)
3. API endpoint requires valid key (which they don't have)
4. No access granted ✅

## 🚀 **Quick Setup**

### **1. Update Cloudflare Tunnel**

```bash
# Edit your config
nano ~/.cloudflared/config.yml

# Add the api subdomain
# Restart cloudflared
sudo systemctl restart cloudflared
```

### **2. Generate and Set Keys**

```bash
python -c "
import secrets
print('# Add these to your .env file:')
print(f'MCP_COPILOT_KEY={secrets.token_urlsafe(32)}')
print(f'MCP_CLI_KEY={secrets.token_urlsafe(32)}')
print(f'MCP_PERSONAL_KEY={secrets.token_urlsafe(32)}')
"
```

### **3. Start Hybrid Server**

```bash
# Start the hybrid auth server
uv run python hybrid_auth_main.py --transport http --port 8000
```

### **4. Test Both Methods**

```bash
# Test browser (will require OAuth)
open https://mcp.deejpotter.com

# Test API (direct with key)
curl -H "X-MCP-CLI-Key: your-cli-key" https://api.mcp.deejpotter.com/health
```

## 📊 **Authentication Matrix**

| Access Method | URL | Auth Required | Use Case |
|---------------|-----|---------------|----------|
| **Browser** | `mcp.deejpotter.com` | Google OAuth | Personal web access |
| **Copilot** | `api.mcp.deejpotter.com` | API Key | VS Code integration |
| **CLI** | `api.mcp.deejpotter.com` | API Key | Scripts, automation |
| **Mobile** | `mcp.deejpotter.com` | Google OAuth | Mobile browser |

## 🔒 **Security Benefits**

✅ **Browser access**: Protected by Google OAuth + MFA  
✅ **API access**: Protected by secret keys  
✅ **No credentials in VS Code settings**: Keys stored securely  
✅ **Different keys per use case**: Revoke individually  
✅ **Audit trail**: Know which method accessed what  

## 🎯 **Best of Both Worlds**

- **For personal browsing**: Seamless Google OAuth
- **For development tools**: Simple API key authentication  
- **For sharing**: Give someone a limited API key
- **For security**: OAuth for humans, API keys for machines

This approach gives you the **convenience of OAuth** for personal use and the **simplicity of API keys** for programmatic access!
