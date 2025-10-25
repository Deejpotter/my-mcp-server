# My MCP Server (Local Development)

A lightweight Model Context Protocol (MCP) server for local VS Code integration. Provides development tools, API integrations, and documentation search capabilities for AI assistants like GitHub Copilot.

> **Note:** This is the local development version. For remote deployment, see [my-mcp-server-remote](https://github.com/Deejpotter/my-mcp-server-remote).

## 🚀 **Quick Start**

### **Prerequisites**

- Python 3.12+ 
- [uv](https://docs.astral.sh/uv/) package manager (will be installed automatically)

### **Installation**

**Windows:**
```cmd
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server
setup-windows.bat
```

**Linux/macOS:**
```bash
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server
chmod +x setup-linux.sh && ./setup-linux.sh
```

**Manual Installation:**
```bash
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server
uv sync
```

## 🛠️ **Features**

### **File & System Operations**

- **read_file** / **write_file** - File management with security checks
- **list_files** - Directory browsing with pattern matching
- **run_command** / **git_command** - Safe command execution
- **search_files** - Content search across files
- **fetch_url** - Web content retrieval

### **Documentation & Code Search**

- **search_docs_online** - Multi-source documentation search (Stack Overflow, GitHub, MDN)
- **github_search_code** - Real-world code examples from GitHub
- **devdocs_search** - Fast API reference lookup
- **context7_search** - Intelligent library-specific documentation

### **Productivity Integrations**

- **ClickUp Tools** - Task management (get workspaces, tasks, create tasks)
- **BookStack Tools** - Knowledge management (search, get pages, create pages)

### **System Resources**

- **system://info** - System and environment details
- **workspace://info** - Project structure analysis
- **git://status** - Version control status

## ⚙️ **Configuration**

### **VS Code Integration**

Add to your VS Code MCP configuration file:

**Location:**
- **Windows:** `%APPDATA%\Code\User\mcp.json`
- **macOS/Linux:** `~/.config/Code/User/mcp.json`

**Configuration:**

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "uv",
      "args": ["run", "python", "/absolute/path/to/my-mcp-server/main.py"],
      "cwd": "/absolute/path/to/my-mcp-server"
    }
  }
}
```

### **Running the Server**

**Development Mode:**

```bash
uv run python main.py
```

**Test the Connection:**

```bash
# Check server startup
uv run python main.py --help

# Verify tools are loaded
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uv run python main.py
```

### **Environment Variables**

Create `.env` file for API integrations (optional):

```env
# Optional API Integrations for enhanced functionality
GITHUB_TOKEN=ghp_your_github_token_here
CLICKUP_API_TOKEN=pk_your_clickup_token_here
BOOKSTACK_URL=https://your-bookstack.com
BOOKSTACK_TOKEN_ID=your_token_id
BOOKSTACK_TOKEN_SECRET=your_token_secret
```

**API Key Setup:**

1. **GitHub:** [Generate Personal Access Token](https://github.com/settings/tokens)
2. **ClickUp:** [Get API Token](https://app.clickup.com/settings/apps)
3. **BookStack:** Create API tokens in Settings > API Tokens

## 📁 **Project Structure**

```text
my-mcp-server/
├── main.py              # MCP server implementation
├── pyproject.toml        # Project dependencies
├── .env.example          # Environment template
├── setup-windows.bat     # Windows setup script
├── setup-linux.sh       # Linux/macOS setup script
└── README.md            # This file
```

## 🔧 **Development**

### **Adding New Tools**

1. Add tool definition to `handle_list_tools()` function
2. Implement tool logic in `handle_call_tool()` function  
3. Follow existing patterns for input validation and error handling

### **Testing Changes**

```bash
# Install in development mode
uv sync

# Run with debug logging
uv run python main.py --log-level DEBUG
```

## 🆘 **Troubleshooting**

### **Common Issues**

**VS Code not detecting MCP server:**
- Verify `mcp.json` file location and syntax
- Check file paths are absolute
- Restart VS Code after configuration changes

**Missing dependencies:**
```bash
uv sync --reinstall
```

**Permission errors:**
```bash
# Linux/macOS
chmod +x setup-linux.sh
```

**API integrations not working:**
- Verify API keys in `.env` file
- Check API token permissions/scopes
- Test API connectivity separately

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 **Related Projects**

- **Remote Server Version:** [my-mcp-server-remote](https://github.com/Deejpotter/my-mcp-server-remote)
- **MCP Protocol:** [Model Context Protocol](https://modelcontextprotocol.io/)
- **VS Code MCP:** [GitHub Copilot with MCP](https://code.visualstudio.com/docs/copilot/copilot-extensibility)

### **Development Workflow**

- "Read the main.py file and analyze its structure"
- "Search GitHub for MCP server implementations"
- "Run git status to check current changes"
- "Create a new Python file with boilerplate code"

### **Documentation Research**

- "Search online docs for React hooks best practices"
- "Find TypeScript interface examples on GitHub"
- "Get Python asyncio documentation from DevDocs"

### **Project Management**

- "Show my ClickUp workspaces and current tasks"
- "Create a new task for implementing authentication"
- "Search BookStack for API documentation"

### **System Administration**

- "List all Python files in the current directory"
- "Check system information and disk usage"
- "Fetch the latest version info from GitHub API"

## 🔧 **Commands**

```bash
# Run server locally
python main.py --transport stdio

# Run HTTP server (for remote access)
python main.py --transport http --host 0.0.0.0 --port 8000

# Docker deployment
docker-compose up -d

# View logs
docker-compose logs -f

# Update deployment
git pull && docker-compose up -d --build
```

## 📝 **Development**

### **Adding New Tools**

1. Add tool definition in `handle_list_tools()`
2. Implement handler in `handle_call_tool()`
3. Test with simple parameters

### **Project Structure**

```
my-mcp-server/
├── main.py              # Main server implementation
├── setup-windows.bat    # Windows setup script
├── setup-linux.sh       # Linux setup script
├── pyproject.toml        # Dependencies and metadata
├── docker-compose.yml   # Docker deployment
├── Dockerfile           # Container configuration
├── .env.example         # Environment template
├── README.md            # This file
└── ADVANCED.md          # Advanced topics
```

## 📚 **Documentation**

- **README.md** - Main documentation (this file)
- **ADVANCED.md** - Deployment, security, integrations, and advanced topics

## 🛡️ **Security**

The server includes multiple security features:

- File size limits and path validation
- Command timeouts and safe execution
- API key authentication for remote access
- Environment variable management

For production deployment and advanced security configuration, see `ADVANCED.md`.

## 📄 **License**

This project is licensed under the terms specified in the LICENSE file.

---

**Need help?** Check `ADVANCED.md` for detailed deployment instructions, API integrations, and troubleshooting guides.
