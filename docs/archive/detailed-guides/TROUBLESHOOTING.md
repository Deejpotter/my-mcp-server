# Troubleshooting Guide

This guide covers common issues, debugging techniques, and solutions for the MCP server.

## 🚨 **Common Issues**

### **VS Code Integration Problems**

#### **Issue: VS Code not detecting MCP server**

**Symptoms:**

- GitHub Copilot doesn't show MCP tools
- No MCP server listed in VS Code

**Solutions:**

1. **Check Configuration File Location**

   ```bash
   # Windows
   %APPDATA%\Code\User\mcp.json
   
   # macOS
   ~/Library/Application Support/Code/User/mcp.json
   
   # Linux
   ~/.config/Code/User/mcp.json
   ```

2. **Verify Configuration Syntax**

   ```json
   {
     "servers": {
       "my-mcp-server": {
         "type": "stdio",
         "command": "uv",
         "args": ["run", "my-mcp-server"],
         "cwd": "/absolute/path/to/my-mcp-server"
       }
     },
     "inputs": []
   }
   ```

3. **Check File Paths**
   - Use absolute paths only
   - On Windows, use forward slashes `/` or escaped backslashes `\\\\`
   - Verify the working directory exists

4. **Restart VS Code**

   ```bash
   # Completely restart VS Code after configuration changes
   ```

#### **Issue: "program not found" or spawn errors**

**Symptoms:**

- Error: `Failed to spawn: my-mcp-server`
- VS Code logs show command execution failures

**Solutions:**

1. **Verify UV Installation**

   ```bash
   uv --version
   # Should show uv version
   ```

2. **Test Command Manually**

   ```bash
   cd /path/to/my-mcp-server
   uv run my-mcp-server --help
   ```

3. **Add Working Directory**

   ```json
   {
     "servers": {
       "my-mcp-server": {
         "type": "stdio",
         "command": "uv",
         "args": ["run", "my-mcp-server"],
         "cwd": "/absolute/path/to/my-mcp-server"
       }
     }
   }
   ```

### **Jan App Integration Problems**

#### **Issue: "Failed to extract command args from config for inputs"**

**Symptoms:**

- Jan app shows configuration error
- Server fails to start in Jan app

**Solutions:**

1. **Use GUI Configuration**
   - Server Name: `My MCP Server`
   - Transport Type: `STDIO`
   - Command: `uv`
   - Arguments: `--directory`, `/path/to/server`, `run`, `my-mcp-server`

2. **Alternative JSON Configuration**

   ```json
   {
     "command": "uv",
     "args": [
       "--directory",
       "/absolute/path/to/my-mcp-server",
       "run",
       "my-mcp-server"
     ],
     "env": {},
     "type": "stdio",
     "active": true
   }
   ```

### **Claude Desktop Integration Problems**

#### **Issue: Server not connecting to Claude Desktop**

**Solutions:**

1. **Check Configuration Location**

   ```bash
   # Windows
   %APPDATA%\Claude\claude_desktop_config.json
   
   # macOS  
   ~/Library/Application Support/Claude/claude_desktop_config.json
   
   # Linux
   ~/.config/Claude/claude_desktop_config.json
   ```

2. **Verify Configuration Format**

   ```json
   {
     "mcpServers": {
       "my-mcp-server": {
         "command": "uv",
         "args": ["run", "my-mcp-server"],
         "cwd": "/absolute/path/to/my-mcp-server"
       }
     }
   }
   ```

## 🔧 **Installation Issues**

### **Missing Dependencies**

#### **Issue: Python or UV not found**

**Solutions:**

1. **Install Python 3.12+**

   ```bash
   # Windows - via winget
   winget install Python.Python.3.12
   
   # macOS - via homebrew
   brew install python@3.12
   
   # Linux - via package manager
   sudo apt install python3.12 python3.12-venv
   ```

2. **Install UV Package Manager**

   ```bash
   # Windows (PowerShell)
   irm https://astral.sh/uv/install.ps1 | iex
   
   # Linux/macOS
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. **Reinstall Dependencies**

   ```bash
   cd /path/to/my-mcp-server
   uv sync --reinstall
   ```

### **Permission Errors**

#### **Issue: Permission denied on scripts**

**Solutions:**

1. **Linux/macOS**

   ```bash
   chmod +x scripts/setup-linux.sh
   ./scripts/setup-linux.sh
   ```

2. **Windows**

   ```powershell
   # Run as Administrator if needed
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   .\scripts\setup-windows.bat
   ```

## 🌐 **API Integration Issues**

### **Authentication Errors**

#### **Issue: API keys not working**

**Solutions:**

1. **Verify Environment File**

   ```bash
   # Check .env file exists
   ls -la .env
   
   # Verify content (without showing secrets)
   grep "API_TOKEN" .env
   ```

2. **Test API Keys**

   ```bash
   # Test GitHub token
   curl -H "Authorization: token YOUR_GITHUB_TOKEN" https://api.github.com/user
   
   # Test ClickUp token  
   curl -H "Authorization: YOUR_CLICKUP_TOKEN" https://api.clickup.com/api/v2/team
   ```

3. **Check API Permissions**
   - GitHub: Ensure `public_repo` scope
   - ClickUp: Verify workspace access
   - BookStack: Check API token permissions

### **Rate Limiting Issues**

#### **Issue: API calls failing with rate limits**

**Solutions:**

1. **Use Authentication**
   - GitHub: Add personal access token
   - Implement request caching for frequently accessed data

2. **Reduce Request Frequency**

   ```python
   # Add delays between requests
   import asyncio
   await asyncio.sleep(1)
   ```

## 🐛 **Debugging Techniques**

### **Enable Debug Logging**

```bash
# Run with detailed logging
uv run python main.py --log-level DEBUG
```

### **Test Individual Components**

#### **Test MCP Protocol**

```bash
# Test tools listing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uv run my-mcp-server

# Test specific tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"file_path":"README.md"}}}' | uv run my-mcp-server

# Test resources
echo '{"jsonrpc":"2.0","id":1,"method":"resources/list","params":{}}' | uv run my-mcp-server
```

#### **Test File Operations**

```bash
# Test file reading
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"file_path":"pyproject.toml"}}}' | uv run my-mcp-server

# Test command execution  
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"run_command","arguments":{"command":"echo hello"}}}' | uv run my-mcp-server
```

### **Check VS Code Logs**

1. **Open Command Palette** (`Ctrl+Shift+P`)
2. **Run:** `Developer: Toggle Developer Tools`
3. **Check Console** for MCP-related errors
4. **Look for spawn/connection errors**

### **Validate JSON Configuration**

```bash
# Test JSON syntax
python -m json.tool mcp.json

# Or use online JSON validator
```

## 📊 **Performance Issues**

### **Slow Response Times**

**Causes:**

- Large file operations
- Slow API calls
- Network timeouts

**Solutions:**

1. **Increase Timeouts**

   ```python
   # In tool implementations
   async with httpx.AsyncClient(timeout=60) as client:
   ```

2. **Implement File Size Limits**

   ```python
   # Already implemented in safe_read_file()
   max_size = 1024 * 1024  # 1MB limit
   ```

3. **Add Progress Indicators**

   ```python
   return [types.TextContent(
       type="text", 
       text="Processing large request, please wait..."
   )]
   ```

### **Memory Usage**

**Monitor memory with:**

```bash
# Check process memory
ps aux | grep python

# Monitor during operation
top -p $(pgrep -f my-mcp-server)
```

## 🔍 **Advanced Debugging**

### **Network Issues**

#### **Test Connectivity**

```bash
# Test GitHub API
curl -v https://api.github.com/

# Test ClickUp API
curl -v https://api.clickup.com/

# Test BookStack instance
curl -v https://your-bookstack.com/api/
```

#### **Proxy/Firewall Issues**

```bash
# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY

# Test without proxy
unset HTTP_PROXY HTTPS_PROXY
```

### **Environment Issues**

#### **Check Python Environment**

```bash
# Verify Python version
python --version
uv run python --version

# Check installed packages
uv pip list

# Verify MCP installation
uv run python -c "import mcp; print('MCP installed')"
```

#### **Virtual Environment Issues**

```bash
# Recreate environment
rm -rf .venv
uv sync
```

## 🆘 **Getting Help**

### **Before Asking for Help**

1. **Check this troubleshooting guide**
2. **Review error messages carefully**  
3. **Test with minimal configuration**
4. **Check the GitHub issues**

### **What to Include in Bug Reports**

1. **System Information**

   ```bash
   # Operating system and version
   uname -a  # Linux/macOS
   ver       # Windows
   
   # Python version
   python --version
   
   # UV version
   uv --version
   ```

2. **Configuration Files** (sanitized of API keys)
   - `mcp.json` or equivalent
   - `pyproject.toml`
   - `.env.example` (not `.env`)

3. **Error Messages**
   - Complete error output
   - VS Code developer console logs
   - Server debug logs

4. **Steps to Reproduce**
   - Exact commands run
   - Configuration used
   - Expected vs actual behavior

### **Useful Commands for Bug Reports**

```bash
# Generate system info
uv run python -c "import platform; print(platform.platform())"

# Test basic functionality
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uv run my-mcp-server | head -20

# Check file permissions
ls -la scripts/
ls -la .env*
```

---

**Still having issues?** Open an issue on [GitHub](https://github.com/Deejpotter/my-mcp-server/issues) with the information above.
