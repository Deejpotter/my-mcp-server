# Multi-Device MCP Server Setup Guide

## 🌟 Overview

You have multiple ways to access your MCP server across all your devices:

1. **Remote Access** (Recommended): Use your Cloudflare tunnel `https://mcp.deejpotter.com`
2. **Local Installation**: Install MCP server locally on each device
3. **VS Code Extension**: Use your existing extension for dynamic provisioning

## 🌐 Option 1: Remote Access (Easiest)

### For All Devices

1. **Open VS Code Settings** (`Ctrl+,` or `Cmd+,`)
2. **Search for "mcp"**
3. **Add this configuration**:

```json
{
  "mcp": {
    "mcpServers": {
      "my-remote-mcp-server": {
        "transport": {
          "type": "http",
          "uri": "https://mcp.deejpotter.com"
        }
      }
    }
  }
}
```

### Advantages

- ✅ Works immediately on any device with VS Code
- ✅ No local installation required
- ✅ Always up-to-date
- ✅ Same server for all devices

### Disadvantages

- ❌ Requires internet connection
- ❌ Slight latency

## 🖥️ Option 2: Local Installation

### Windows Devices

```batch
# Run setup-windows-device.bat
# This will:
# - Clone the repository
# - Install dependencies
# - Configure VS Code
```

### macOS/Linux Devices

```bash
# Run setup-device.sh
# This will:
# - Clone the repository
# - Install dependencies  
# - Configure VS Code
```

### Advantages

- ✅ Works offline
- ✅ No latency
- ✅ Full control

### Disadvantages

- ❌ Need to update each device separately
- ❌ More setup required

## 🔌 Option 3: VS Code Extension

You already have a VS Code extension in `vscode-extension/`!

### To use it

1. **Package the extension**:

   ```bash
   cd vscode-extension
   npx vsce package
   ```

2. **Install on each device**:

   ```bash
   code --install-extension my-mcp-server-extension-0.1.0.vsix
   ```

3. **Configure in VS Code settings**:
   - Set `myMcpServer.useRemote: true` for remote access
   - Set `myMcpServer.useRemote: false` for local access

## 🚀 Recommended Setup by Device Type

### **Main Development Machine:**

- Use **Local Installation** for best performance
- Keep the source code for development

### **Laptop/Secondary Machines:**

- Use **Remote Access** for simplicity
- Quick setup, always works

### **Work/Shared Machines:**

- Use **VS Code Extension** for easy deployment
- Can be packaged and shared

### **Mobile/Tablets (if using VS Code):**

- Use **Remote Access** only
- Minimal setup required

## ⚙️ Quick Setup Commands

### Remote Access (All Devices)

```bash
# Add to VS Code settings.json:
{
  "mcp": {
    "mcpServers": {
      "my-remote-mcp-server": {
        "transport": {
          "type": "http", 
          "uri": "https://mcp.deejpotter.com"
        }
      }
    }
  }
}
```

### Local Installation

```bash
# Windows:
setup-windows-device.bat

# macOS/Linux:
chmod +x setup-device.sh
./setup-device.sh
```

### Extension Installation

```bash
# In vscode-extension directory:
npx vsce package
code --install-extension my-mcp-server-extension-0.1.0.vsix
```

## 🔧 Testing Your Setup

### Test Remote Access

```bash
curl https://mcp.deejpotter.com/health
# Should return: {"status":"healthy","server":"my-mcp-server"}
```

### Test Local Installation

```bash
cd my-mcp-server
uv run python main.py --help
```

### Test in VS Code

1. Open Command Palette (`Ctrl+Shift+P`)
2. Search for "MCP" or look for your server in GitHub Copilot settings
3. Try using the tools (echo, calculate, current_time, search_docs)

## 🎯 Recommendation

**Start with Remote Access** for all your devices:

- Fastest to set up
- Works everywhere
- Your server is already running and accessible

Then consider local installations for your primary development machines if you want the best performance.
