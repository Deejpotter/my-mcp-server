# My MCP Server

A comprehensive Model Context Protocol (MCP) server with **modular architecture** providing development tools, API integrations, and documentation search capabilities for AI assistants.

## 📚 **Documentation**

**📂 All documentation is consolidated in [`docs/COMPREHENSIVE_GUIDE.md`](docs/COMPREHENSIVE_GUIDE.md)** - complete guide covering development, security, API integrations, and troubleshooting.

**Quick Links:**

- **[Complete Guide](docs/COMPREHENSIVE_GUIDE.md)** - Everything you need in one document

> **Note:** This is the local development version. For remote deployment, see [my-mcp-server-remote](https://github.com/Deejpotter/my-mcp-server-remote).

## 🚀 **Quick Start**

### **Prerequisites**

- Python 3.12+

### **Installation (Recommended: Use a Virtual Environment)**

**Step 1: Clone the repository**

```bash
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server
```

**Step 2: Create and activate a virtual environment**

```bash
# On Linux/macOS
python3 -m venv .venv
source .venv/bin/activate

# On Windows
python -m venv .venv
.venv\Scripts\activate
```

**Step 3: Install dependencies**

```bash
pip install -r requirements-test.txt
```

## 🛠️ **Features**

- **File & System Operations** - File management, directory browsing, command execution with security hardening, system resource monitoring
- **Web Search** - Real-time web and news search via DuckDuckGo for blog posts, articles, recent discussions, and breaking news
- **Documentation Search** - Multi-source documentation lookup (MDN, Stack Overflow, GitHub, DevDocs) with intelligent caching
- **API Integrations** - ClickUp tasks, BookStack knowledge management (create/read/search), GitHub code search
- **Development Tools** - Git operations, project analysis, real-time web content, system statistics monitoring
- **Performance Optimizations** - API response caching (5-min TTL), rate limiting protection, reduced API quota consumption
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
      "command": "python",
      "args": ["main.py"],
      "cwd": "/absolute/path/to/my-mcp-server"
    }
  },
  "inputs": []
}
```

### **Other MCP Clients**

For Claude Desktop, Jan app, Continue.dev, and other clients, see the [Complete Guide](docs/COMPREHENSIVE_GUIDE.md).

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

```bash
# Navigate to project directory
cd /path/to/my-mcp-server

# Test server startup
python main.py --help

# Test connection
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | python main.py

# Validate security hardening (includes MCP logging compliance)
source .venv/bin/activate  # (Linux/macOS)
.venv\Scripts\activate     # (Windows)
python scripts/security_check.py
```

## 📁 **Project Structure**

```text
my-mcp-server/
├── main.py                      # MCP server entry point
├── pyproject.toml               # Project dependencies & config
├── .env.example                 # Environment template
├── scripts/
│   └── security_check.py        # Security validation
├── src/
│   ├── tool_registry.py         # Tool routing & performance tracking
│   ├── resources.py             # MCP resources
│   ├── tools/                   # Tool implementations
│   │   ├── file_operations.py   # File & batch validation tools
│   │   └── system_commands.py   # System monitoring & commands
│   ├── integrations/            # External API integrations
│   │   └── external_apis.py     # ClickUp, GitHub, BookStack, Context7
│   └── utils/                   # Shared utilities
│       ├── security.py          # Security & path validation
│       ├── cache_rate_limit.py  # Caching & rate limiting
│       └── performance.py       # Performance tracking
├── tests/
│   ├── test_integration.py      # Integration tests
│   ├── test_security_hardening.py # Security tests
│   └── test_new_features.py     # Feature tests
├── docs/
│   └── COMPREHENSIVE_GUIDE.md   # Complete setup guide
└── vscode-extension/            # VS Code extension files
    ├── package.json             # Extension manifest
    └── src/extension.ts         # Extension implementation
```

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 **Related Projects**

- **[MCP Protocol Specification](https://modelcontextprotocol.io/)** - Official MCP documentation
- **[Remote Server Version](https://github.com/Deejpotter/my-mcp-server-remote)** - For cloud deployment

---

**Need help?** Check the [documentation guides](docs/) for detailed setup instructions, API integrations, and troubleshooting.
