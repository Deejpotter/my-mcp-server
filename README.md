# My MCP Server

A comprehensive Model Context Protocol (MCP) server with **modular architecture** providing development tools, API integrations, and documentation search capabilities for AI assistants.

## 🏗️ **Architecture**

This project follows MCP best practices with a **clean modular design**:

- **91.6% reduction** in main file complexity (1,794 → 150 lines)
- **Separation of concerns** - tools, integrations, utilities in separate modules
- **Easy to extend** - add new functionality without touching core code
- **Maintainable** - clear structure for debugging and enhancement

## 📚 **Documentation**

**📂 All documentation is organized in [`docs/`](docs/)** - see [`docs/README.md`](docs/README.md) for the complete overview.

**Quick Links:**

- **[Development Guide](docs/DEVELOPMENT.md)** - Setup and development workflow  
- **[Security Guidelines](docs/SECURITY_GUIDELINES.md)** - Security implementation and best practices

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
scripts/setup-windows.bat
```

**Linux/macOS:**

```bash
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server
chmod +x scripts/setup-linux.sh && ./scripts/setup-linux.sh
```

**Manual Installation:**

```bash
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server
uv sync
```

## 🛠️ **Features**

- **File & System Operations** - File management, directory browsing, command execution with security hardening
- **Documentation Search** - Multi-source documentation lookup (Stack Overflow, GitHub, MDN, DevDocs)
- **API Integrations** - ClickUp tasks, BookStack knowledge management, GitHub code search
- **Development Tools** - Git operations, project analysis, real-time web content
- **🔒 Enterprise Security** - Comprehensive protection against injection attacks, path traversal, and credential exposure

### **Security Features**

This MCP server includes **enterprise-grade security hardening**:

- **Command Injection Protection** - Allowlist-based validation prevents arbitrary code execution
- **Path Traversal Prevention** - Canonical path resolution blocks unauthorized file access  
- **Credential Protection** - Environment variable filtering prevents accidental exposure
- **SSRF Protection** - URL validation prevents server-side request forgery attacks
- **Resource Limits** - File size and timeout controls prevent resource exhaustion

See [Security Guidelines](docs/SECURITY_GUIDELINES.md) for implementation details.

## ⚙️ **Quick Configuration**

### **VS Code (GitHub Copilot)**

Add to `%APPDATA%\Code\User\mcp.json` (Windows) or `~/.config/Code/User/mcp.json` (Linux/macOS):

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

### **Other MCP Clients**

For Claude Desktop, Jan app, Continue.dev, and other clients, see [Troubleshooting Guide](docs/TROUBLESHOOTING.md).

### **Environment Variables (Optional)**

Create `.env` file for API integrations:

```env
GITHUB_TOKEN=ghp_your_token_here
CLICKUP_API_TOKEN=pk_your_token_here
BOOKSTACK_URL=https://your-bookstack.com
BOOKSTACK_TOKEN_ID=your_id
BOOKSTACK_TOKEN_SECRET=your_secret
CONTEXT7_API_KEY=your_context7_key_here
```

See [API Integrations Guide](docs/API-INTEGRATIONS.md) for setup details.

## 🔧 **Testing the Server**

```bash
# Navigate to project directory
cd /path/to/my-mcp-server

# Test server startup
uv run my-mcp-server --help

# Test connection
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uv run my-mcp-server

# Validate security hardening
python validate_core_security.py
```

## � **Project Structure**

```text
my-mcp-server/
├── main.py                    # MCP server implementation
├── pyproject.toml             # Project dependencies
├── .env.example               # Environment template
├── scripts/
│   ├── setup-windows.bat      # Windows setup
│   └── setup-linux.sh         # Linux/macOS setup
└── docs/
    ├── API-INTEGRATIONS.md    # API setup guides
    ├── DEVELOPMENT.md         # Architecture & workflow
    ├── TROUBLESHOOTING.md     # Common issues & solutions
    └── EXTENDING.md           # Adding new tools
```

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 **Related Projects**

- **[MCP Protocol Specification](https://modelcontextprotocol.io/)** - Official MCP documentation
- **[Remote Server Version](https://github.com/Deejpotter/my-mcp-server-remote)** - For cloud deployment

---

**Need help?** Check the [documentation guides](docs/) for detailed setup instructions, API integrations, and troubleshooting.
