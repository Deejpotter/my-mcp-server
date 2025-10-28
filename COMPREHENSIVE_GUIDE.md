# MCP Server Comprehensive Guide

**Complete development, security, and integration documentation for the Model Context Protocol server.**

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture & Development](#architecture--development)
- [Security Guidelines](#security-guidelines)
- [API Integrations](#api-integrations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Quick Start

### Prerequisites

- Python 3.12+

### Installation (Recommended: Use a Virtual Environment)

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

### VS Code Configuration

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

### Environment Variables (Optional)

Create `.env` file for API integrations:

```env
GITHUB_TOKEN=ghp_your_token_here
CLICKUP_API_TOKEN=pk_your_token_here
BOOKSTACK_URL=https://your-bookstack.com
BOOKSTACK_TOKEN_ID=your_id
BOOKSTACK_TOKEN_SECRET=your_secret
CONTEXT7_API_KEY=your_context7_key_here
```

### Testing

```bash
# Test server startup
python main.py --help

# Test connection
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | python main.py

# Validate security
python scripts/validate_core_security.py
```

---

## Architecture & Development

### MCP Protocol Fundamentals

The Model Context Protocol (MCP) enables AI assistants to securely call server functions:

- **Tools**: Functions that AI can call (commands, API calls)
- **Resources**: Data sources that AI can read (files, databases)
- **Transport**: Communication method (stdio for local, HTTP for remote)

### Server Architecture

```
my-mcp-server/
├── main.py                    # Core MCP server implementation
├── src/mcp_server/            # Modular server components
│   ├── tools/                 # Tool implementations
│   ├── integrations/          # API integrations
│   └── utils/                 # Security and utilities
├── scripts/                   # Security validation scripts
├── docs/                      # Documentation
└── tests/                     # Test suite
```

### Development Workflow

#### Local Setup

1. **Clone and Setup**:

   ```bash
   git clone https://github.com/Deejpotter/my-mcp-server.git
   cd my-mcp-server

# Create and activate venv first, then

  pip install -r requirements-test.txt

   ```

2. **Development Environment**:

   ```bash
   # Run with debug logging
  python main.py --log-level DEBUG
   ```

3. **Security Validation** (Required before commits):

   ```bash
   # Comprehensive security check (validation + credential scan)
   python scripts/security_check.py
   
   # Quick security validation only
   python scripts/security_check.py --quick
   
   # Expected: ✅ ALL SECURITY CHECKS PASSED
   ```

#### Pre-Commit Security Checklist

**REQUIRED before any commit:**

```bash
# 1. Security validation
python scripts/security_check.py

# 2. Functional testing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | python main.py
```

All must pass before committing changes.

#### Adding New Tools

1. **Define Tool Schema** in `main.py` `handle_list_tools()`:

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

2. **Implement Tool Handler** in `main.py` `handle_call_tool()`:

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

3. **Test Implementation**:

   ```bash

  echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"your_tool_name","arguments":{"param1":"test"}}}' | python main.py

   ```

#### Code Standards

- **Security-First**: Always use hardened security functions (`safe_read_file`, `run_command`, etc.)
- **Error Handling**: Return `TextContent` for all tool calls, never throw exceptions
- **Input Validation**: Validate all user inputs before processing
- **Logging**: **CRITICAL** - Never use `print()` or write to stdout in MCP servers (breaks JSON-RPC)
- **Documentation**: Update docs when adding new functionality

#### Logging Guidelines

**⚠️ CRITICAL: MCP Logging Requirements**

For STDIO-based MCP servers, **never write to standard output (stdout)**:

```python
# ❌ NEVER DO THIS - Breaks MCP communication
print("Debug message")
console.log("Debug message")  # JavaScript
fmt.Println("Debug message")  # Go

# ✅ CORRECT - Use logging to stderr
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr  # IMPORTANT: Always stderr for MCP servers
)
logger = logging.getLogger(__name__)

logger.info("Server started")
logger.error("Error occurred")
```

**Why this matters:**

- MCP servers communicate via JSON-RPC over stdout
- Any stdout output corrupts the message stream
- This breaks the connection between AI client and server
- Always use stderr for logging or write to files

---

## Security Guidelines

### Security Architecture

This MCP server includes comprehensive security hardening against:

- **Command Injection (CWE-78)**: Allowlist validation and shell metacharacter detection
- **Path Traversal (CWE-22)**: Canonical path resolution and directory allowlists  
- **Credential Exposure**: Environment variable filtering
- **Resource Exhaustion**: File size limits and timeout controls
- **SSRF**: URL validation for fetch operations

### Core Security Functions

#### Command Execution Security

```python
# Allowlist-based command validation
ALLOWED_COMMANDS = {
    'git': ['status', 'log', 'diff', 'show', 'branch'],
    'ls': [], 'pwd': [], 'echo': [], 'cat': [],
    'grep': ['-n', '-i', '-r'],
    'find': ['-name', '-type', '-maxdepth'],
    'which': [], 'whoami': []
}

# Safe command execution
result = run_command("git status")  # ✅ Allowed
result = run_command("rm -rf /")     # ❌ Blocked
```

#### File Access Security

```python
# Safe file operations with path validation
content = safe_read_file("./config.json")        # ✅ Allowed  
content = safe_read_file("../../../etc/passwd")  # ❌ Blocked

# Directory allowlist protection
ALLOWED_DIRECTORIES = [
    os.getcwd(),           # Current working directory
    tempfile.gettempdir()  # System temp directory
]
```

#### Environment Protection

```python
# Sensitive pattern detection
SENSITIVE_ENV_PATTERNS = [
    "_KEY", "_TOKEN", "_SECRET", "_PASSWORD", "_AUTH",
    "_PRIVATE", "_CREDENTIAL", "API_", "SECRET_", "GITHUB_"
]

# Filtered environment (credentials removed)
safe_env = filter_sensitive_environment()
```

### Developer Security Guidelines

#### ✅ Secure File Operations

```python
from mcp_server.utils.security import safe_read_file, safe_write_file

# Use secure file functions with size limits and path validation
content = safe_read_file(file_path, max_size=1024*1024)
safe_write_file(output_path, content)

# Always validate paths
validation = validate_file_path(user_path, "read")
if not validation["valid"]:
    raise ValueError(f"Invalid path: {validation['checks']}")
```

#### ✅ Secure Command Execution

```python
from mcp_server.utils.security import run_command

# Use allowlist-validated command execution
result = run_command("git log --oneline")
if result["success"]:
    output = result["stdout"]
else:
    error = result["error"]
```

#### ✅ Secure URL Handling

```python
from mcp_server.tools.search_tools import _validate_url_security

# Validate URLs before fetching
validation = _validate_url_security(user_url)
if not validation["valid"]:
    raise ValueError(f"Invalid URL: {validation['error']}")

# Use secure HTTP client with limits
async with httpx.AsyncClient(timeout=10) as client:
    response = await client.get(validated_url)
```

#### ❌ Security Anti-Patterns

**Never do these:**

```python
# Direct file operations without validation
with open(user_provided_path, 'r') as f:  # VULNERABLE
    content = f.read()

# Shell=True with user input
subprocess.run(user_command, shell=True)  # COMMAND INJECTION

# Unlimited fetches
requests.get(user_url, timeout=None)  # RESOURCE EXHAUSTION
```

### Security Testing

```bash
# Run comprehensive security tests
python scripts/security_check.py

# Expected output:
# ✅ ALL SECURITY CHECKS PASSED (includes MCP stdout violation check)

# Quick validation only (skips credential scan)  
python scripts/security_check.py --quick
```

---

## API Integrations

### Environment Setup

Create `.env` file with API credentials:

```env
# GitHub API (Optional - for enhanced search results)
GITHUB_TOKEN=ghp_your_github_token_here

# ClickUp API
CLICKUP_API_TOKEN=pk_your_clickup_api_token_here

# BookStack API
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_token_id_here
BOOKSTACK_TOKEN_SECRET=your_token_secret_here

# Context7 API (Optional - for enhanced documentation search)
CONTEXT7_API_KEY=your_context7_key_here
```

### GitHub Integration

#### Setup

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Create token with `public_repo` scope
3. Add to `.env`: `GITHUB_TOKEN=ghp_your_token_here`

#### Benefits

- Higher rate limits (5000/hour vs 60/hour)
- Access to private repositories
- Enhanced search capabilities

#### Available Tools

**`github_search_code`** - Search GitHub repositories for code examples

```json
{
  "query": "MCP server implementation",
  "language": "python",
  "limit": 5
}
```

### Context7 Integration

#### Setup

**Option 1: No API Key (Limited)**

- Works without setup but has rate limits

**Option 2: With API Key (Enhanced)**

1. Visit [Context7.com](https://context7.com) and create account
2. Generate API key from dashboard
3. Add to `.env`: `CONTEXT7_API_KEY=your_api_key_here`

#### Available Tools

**`context7_search`** - Search up-to-date library documentation

```json
{
  "library": "fastapi",
  "query": "async routes middleware",
  "tokens": 3000
}
```

### ClickUp Integration

#### Setup

1. Go to [ClickUp Settings > Apps](https://app.clickup.com/settings/apps)
2. Create new API token
3. Add to `.env`: `CLICKUP_API_TOKEN=pk_your_token_here`

#### Available Tools

**`clickup_get_workspaces`** - Get all accessible workspaces

**`clickup_get_tasks`** - Get tasks from specific list

```json
{
  "list_id": "123456789",
  "status": "open",
  "assignee": "user_id"
}
```

**`clickup_create_task`** - Create new task

```json
{
  "list_id": "123456789",
  "name": "Fix MCP server bug",
  "description": "Server crashes on large files",
  "priority": "high",
  "assignees": ["987654321"]
}
```

### BookStack Integration

#### Setup

1. Go to BookStack Settings > API Tokens
2. Create new token with appropriate permissions
3. Add credentials to `.env`

#### Available Tools

**`bookstack_search`** - Search content across BookStack

```json
{
  "query": "MCP configuration",
  "type": "page",
  "count": 10
}
```

**`bookstack_get_page`** - Get specific page content

```json
{
  "page_id": "42"
}
```

**`bookstack_create_page`** - Create new page

```json
{
  "book_id": "42",
  "name": "MCP Server Configuration",
  "markdown": "# Configuration\n\nSetup guide..."
}
```

### Documentation Search Tools

#### `search_docs_online` - Multi-source search

Search across Stack Overflow, GitHub, and MDN simultaneously:

```json
{
  "query": "async await best practices",
  "source": "all",
  "limit": 5
}
```

#### `devdocs_search` - API reference lookup

Quick API reference using DevDocs.io:

```json
{
  "query": "javascript async",
  "docs": "javascript"
}
```

### Adding New API Integrations

#### 1. Environment Variables

Add to `.env.example` and local `.env`:

```env
NEW_SERVICE_API_KEY=your_api_key_here
NEW_SERVICE_BASE_URL=https://api.newservice.com
```

#### 2. Tool Definition

Add in `main.py` `handle_list_tools()`:

```python
Tool(
    name="newservice_action",
    description="Perform action with new service",
    inputSchema={
        "type": "object",
        "properties": {
            "param1": {"type": "string", "description": "Parameter description"}
        },
        "required": ["param1"]
    }
)
```

#### 3. Tool Implementation

Add handler in `main.py` `handle_call_tool()`:

```python
elif name == "newservice_action":
    try:
        api_key = os.getenv("NEW_SERVICE_API_KEY")
        if not api_key:
            return [types.TextContent(
                type="text", 
                text="API key not found. Set NEW_SERVICE_API_KEY environment variable."
            )]
        
        # Your API logic here
        result = await call_new_service_api(api_key, arguments)
        
        return [types.TextContent(type="text", text=f"Success: {result}")]
    except Exception as e:
        return [types.TextContent(type="text", text=f"Error: {str(e)}")]
```

---

## Troubleshooting

### VS Code Integration Issues

#### Server Not Detected

**Check Configuration Location:**

```bash
# Windows
%APPDATA%\Code\User\mcp.json

# macOS
~/Library/Application Support/Code/User/mcp.json

# Linux
~/.config/Code/User/mcp.json
```

**Verify Configuration:**

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

**Common Fixes:**

- Use absolute paths only
- On Windows, use forward slashes `/`
- Verify working directory exists
- Restart VS Code after changes

#### "Program Not Found" Errors

**Verify Python & venv Installation:**

```bash
python --version
# Check venv activation
which python  # Should show path inside .venv
pip --version # Should show pip inside .venv
cd /path/to/my-mcp-server
python main.py --help
```

**Add Working Directory:**

```json
"cwd": "/absolute/path/to/my-mcp-server"
```

### Jan App Integration

#### "Failed to Extract Command Args"

**Use GUI Configuration:**

- Server Name: `My MCP Server`
- Transport Type: `STDIO`
- Command: `/home/deejpotter/Repos/my-mcp-server/.venv/bin/python`
- Arguments: `/home/deejpotter/Repos/my-mcp-server/main.py`

**Alternative JSON (Linux/macOS):**

```json
{
  "command": "/home/deejpotter/Repos/my-mcp-server/.venv/bin/python",
  "args": [
    "/home/deejpotter/Repos/my-mcp-server/main.py"
  ],
  "type": "stdio",
  "active": true
}
```

**Alternative JSON (Windows):**

```json
{
  "command": "C:/Users/YourUsername/Repos/my-mcp-server/.venv/Scripts/python.exe",
  "args": [
    "C:/Users/YourUsername/Repos/my-mcp-server/main.py"
  ],
  "type": "stdio",
  "active": true
}
```

**Note:** Your MCP server runs directly with Python (no need for `uv` command), since it's already configured to use stdio transport by default. On Windows, use forward slashes `/` in paths and point to `python.exe` in the `.venv/Scripts/` directory.

### Claude Desktop Integration

**Configuration Location:**

```bash
# Windows
%APPDATA%\Claude\claude_desktop_config.json

# macOS  
~/Library/Application Support/Claude/claude_desktop_config.json

# Linux
~/.config/Claude/claude_desktop_config.json
```

**Configuration Format:**

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "python",
      "args": ["main.py"],
      "cwd": "/absolute/path/to/my-mcp-server"
    }
  }
}
```

### Installation Issues

#### Missing Dependencies

**Install Python 3.12+:**

```bash
# Windows
winget install Python.Python.3.12

# macOS
brew install python@3.12

# Linux
sudo apt install python3.12 python3.12-venv
```

#### Permission Errors

**Linux/macOS:**

```bash
chmod +x scripts/security_check.py
./scripts/security_check.py
```

**Windows:**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\security_check.py
```

### API Integration Issues

#### Authentication Errors

**Verify Environment File:**

```bash
# Check .env exists
ls -la .env

# Test API keys (example)
curl -H "Authorization: token YOUR_GITHUB_TOKEN" https://api.github.com/user
```

**Check API Permissions:**

- GitHub: Ensure `public_repo` scope
- ClickUp: Verify workspace access
- BookStack: Check API token permissions

#### Rate Limiting

**Solutions:**

- Add authentication tokens for higher limits
- Implement request caching
- Add delays between requests

### Debugging Techniques

#### Enable Debug Logging

```bash
python main.py --log-level DEBUG
```

#### Test MCP Protocol

```bash
# Test tools listing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | python main.py

# Test specific tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"file_path":"README.md"}}}' | python main.py
```

#### Test File Operations

```bash
# Test file reading
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"file_path":"pyproject.toml"}}}' | python main.py

# Test command execution  
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"run_command","arguments":{"command":"echo hello"}}}' | python main.py
```

#### Check VS Code Logs

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: `Developer: Toggle Developer Tools`
3. Check Console for MCP-related errors

### Performance Issues

#### Slow Response Times

**Solutions:**

- Increase timeouts in HTTP clients
- Implement file size limits (already done)
- Add progress indicators for long operations

#### Memory Usage

**Monitor with:**

```bash
# Check process memory
ps aux | grep python

# Monitor during operation
top -p $(pgrep -f my-mcp-server)
```

### Getting Help

#### Before Asking for Help

1. Check this troubleshooting guide
2. Review error messages carefully
3. Test with minimal configuration
4. Check GitHub issues

#### Include in Bug Reports

1. **System Information:**

   ```bash
   uname -a  # Linux/macOS
   python --version

  python --version

   ```

2. **Configuration Files** (sanitized)
3. **Complete Error Messages**
4. **Steps to Reproduce**

---

## Contributing

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-tool`
3. Make changes with tests
4. **Run security validation**: `python scripts/security_check.py`
5. **Run credential scan**: `python scripts/scan_credentials.py`
6. Update documentation
7. Submit pull request

### Contribution Types

- **New Tools**: Add functionality for AI assistants
- **API Integrations**: Connect to new services
- **Bug Fixes**: Improve reliability
- **Documentation**: Enhance user experience
- **Performance**: Optimize speed and memory usage
- **Security**: Enhance protection and validation

### Release Process

1. Update version in `pyproject.toml`
2. Update `CHANGELOG.md`
3. **Run full security validation**
4. Tag release: `git tag v0.2.0`
5. Push tags: `git push --tags`

### Pre-Release Security Checklist

- [ ] **Security validation passes**: `python scripts/security_check.py`
- [ ] **No credentials exposed**: Included in comprehensive security check
- [ ] All functional tests pass
- [ ] Documentation updated
- [ ] No secrets in code
- [ ] Security guidelines followed

---

**Need additional help?** Check the [GitHub repository](https://github.com/Deejpotter/my-mcp-server) or open an issue.
