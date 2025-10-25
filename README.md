# My MCP Server

A comprehensive Model Context Protocol (MCP) server that provides development tools, API integrations, and documentation search capabilities for AI assistants.

## 🚀 **Quick Start**

### **Windows Setup**

```cmd
curl -o setup-windows.bat https://raw.githubusercontent.com/Deejpotter/my-mcp-server/main/setup-windows.bat && setup-windows.bat
```

### **Linux Setup**

```bash
curl -fsSL https://raw.githubusercontent.com/Deejpotter/my-mcp-server/main/setup-linux.sh | bash
```

### **Manual Installation**

```bash
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e .
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

### **VS Code MCP Setup**

Add to `~/.config/Code/User/mcp.json` (macOS/Linux) or `%APPDATA%\Code\User\mcp.json` (Windows):

```json
{
  "mcpServers": {
    "my-mcp-server-local": {
      "command": "python",
      "args": ["/path/to/your/my-mcp-server/main.py"],
      "env": {}
    }
  }
}
```

### **Environment Variables**

Create `.env` file for API integrations:

```env
# Server Authentication (for remote deployment)
MY_SERVER_API_KEY=your_secure_api_key_here

# Optional API Integrations
GITHUB_TOKEN=ghp_your_github_token_here
CLICKUP_API_TOKEN=pk_your_clickup_token_here
BOOKSTACK_URL=https://your-bookstack.com
BOOKSTACK_TOKEN_ID=your_token_id
BOOKSTACK_TOKEN_SECRET=your_token_secret
```

## 🌐 **Remote Deployment**

Deploy with Docker for remote access:

```bash
# Local deployment
docker-compose up -d

# ARM devices (Raspberry Pi, Orange Pi)
docker-compose -f docker-compose.orangepi.yml up -d

# Health check
curl http://localhost:8000/health
```

For public access, see `ADVANCED.md` for Cloudflare Tunnel setup and authentication.

## 💡 **Usage Examples**

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
