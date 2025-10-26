# Development Guide

This guide covers the architecture, development workflow, and contribution process for the MCP server.

## 🏗️ **Architecture Overview**

### **MCP Protocol Fundamentals**

The Model Context Protocol (MCP) enables AI assistants to securely call server functions and access data sources:

- **Tools**: Functions that AI can call (like commands, API calls)
- **Resources**: Data sources that AI can read (like files, databases)
- **Transport**: Communication method (stdio for local, HTTP for remote)

### **Server Architecture**

```
my-mcp-server/
├── main.py              # Core MCP server implementation
├── docs/                 # Documentation files
├── scripts/              # Setup and utility scripts
├── vscode-extension/     # VS Code extension for auto-registration
├── .env.example          # Environment template
└── pyproject.toml        # Project configuration
```

### **Key Components**

#### **1. Server Instance**

```python
server = Server("my-mcp-server")
```

#### **2. Transport Layer**

- **stdio**: Direct communication with VS Code/GitHub Copilot
- **JSON-RPC**: Protocol for function calls and responses

#### **3. Handler Functions**

- `handle_list_resources()`: Define available data sources
- `handle_read_resource()`: Fetch content from resources
- `handle_list_tools()`: Define available functions
- `handle_call_tool()`: Execute tool calls

## 🛠️ **Development Workflow**

### **Local Setup**

1. **Clone and Setup**:

   ```bash
   git clone https://github.com/Deejpotter/my-mcp-server.git
   cd my-mcp-server
   
   # Run setup script
   scripts/setup-windows.bat  # Windows
   scripts/setup-linux.sh     # Linux/macOS
   ```

2. **Development Environment**:

   ```bash
   # Activate environment
   uv sync
   
   # Run with debug logging
   uv run python main.py --log-level DEBUG
   ```

3. **Security Validation**:

   ```bash
   # Validate security hardening (run before any commits)
   python validate_core_security.py
   
   # Scan for exposed credentials
   python scan_credentials.py
   
   # Expected output: ✅ ALL SECURITY TESTS PASSED
   ```

4. **Functional Testing**:

   ```bash
   # Test tool listing
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uv run my-mcp-server
   
   # Test specific tool
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_file","arguments":{"file_path":"README.md"}}}' | uv run my-mcp-server
   ```

### **Pre-Commit Security Checklist**

Before committing any changes, always run:

```bash
# 1. Security validation
python validate_core_security.py

# 2. Credential scanning  
python scan_credentials.py

# 3. Functional testing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uv run my-mcp-server

# All should pass before committing
```

### **Code Structure**

#### **Tool Categories**

1. **File Operations**: `read_file`, `write_file`, `list_files`
2. **System Commands**: `run_command`, `git_command`
3. **Search**: `search_files`, `search_docs_online`
4. **External APIs**: `clickup_*`, `bookstack_*`, `github_search_code`

#### **Security Functions**

- `safe_read_file()`: File access with size limits and path validation
- `safe_write_file()`: File writing with security checks and directory creation
- `run_command()`: Shell execution with allowlist validation and timeout protection
- `validate_file_path()`: Path validation against security policies
- `filter_sensitive_environment()`: Environment variable filtering for credential protection

**🔒 Security-First Development**: All file operations and command executions use hardened security functions with comprehensive protection against injection attacks, path traversal, and credential exposure.

## 🔧 **Adding New Tools**

### **Step 1: Define Tool Schema**

Add to `handle_list_tools()` in `main.py`:

```python
Tool(
    name="your_tool_name",
    description="Clear description of what the tool does",
    inputSchema={
        "type": "object",
        "properties": {
            "param1": {
                "type": "string", 
                "description": "Parameter description"
            },
            "param2": {
                "type": "integer", 
                "default": 10
            }
        },
        "required": ["param1"]
    }
)
```

### **Step 2: Implement Tool Handler**

Add to `handle_call_tool()` in `main.py`:

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

### **Step 3: Test Implementation**

```bash
# Test new tool
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"your_tool_name","arguments":{"param1":"test"}}}' | uv run my-mcp-server
```

### **Step 4: Add Documentation**

Update relevant documentation:

- Tool description in this file
- Usage examples in API-INTEGRATIONS.md
- Update README.md feature list

## 📊 **Adding New Resources**

### **Step 1: Define Resource**

Add to `handle_list_resources()`:

```python
Resource(
    uri="custom://your_resource",
    name="Your Resource Name", 
    description="Description of your resource",
    mimeType="application/json"
)
```

### **Step 2: Implement Resource Handler**

Add to `handle_read_resource()`:

```python
elif uri == "custom://your_resource":
    data = fetch_your_custom_data()
    return json.dumps(data, indent=2)
```

## 🔗 **External API Integration**

### **Best Practices**

1. **Environment Variables**: Store API keys in `.env`
2. **Error Handling**: Always return TextContent, never throw exceptions
3. **Rate Limiting**: Implement caching for frequently accessed data
4. **Timeouts**: Use httpx.AsyncClient with timeout protection

### **Template for New API**

```python
elif name == "newapi_action":
    try:
        api_key = os.getenv("NEWAPI_TOKEN")
        if not api_key:
            return [types.TextContent(
                type="text", 
                text="API key not found. Set NEWAPI_TOKEN environment variable."
            )]
        
        headers = {"Authorization": f"Bearer {api_key}"}
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://api.newservice.com/endpoint", 
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                return [types.TextContent(
                    type="text", 
                    text=f"Success: {data}"
                )]
            else:
                return [types.TextContent(
                    type="text", 
                    text=f"API error: {response.status_code}"
                )]
                
    except Exception as e:
        return [types.TextContent(
            type="text", 
            text=f"Error: {str(e)}"
        )]
```

## 🧪 **Testing Guidelines**

### **Unit Testing**

Test individual functions:

```python
def test_safe_read_file():
    content = safe_read_file("test.txt")
    assert len(content) > 0

def test_run_command():
    result = run_command("echo hello")
    assert result["success"] == True
    assert "hello" in result["stdout"]
```

### **Integration Testing**

Test MCP protocol compliance:

```bash
# Test all tools list properly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uv run my-mcp-server

# Test all resources list properly  
echo '{"jsonrpc":"2.0","id":1,"method":"resources/list","params":{}}' | uv run my-mcp-server

# Test invalid tool call handling
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"invalid_tool","arguments":{}}}' | uv run my-mcp-server
```

### **Manual Testing**

Test with real MCP clients:

1. Configure in VS Code and test with GitHub Copilot
2. Test with Claude Desktop
3. Test with Jan app or other MCP clients

## 📝 **Code Standards**

### **Python Style**

- Follow PEP 8 style guidelines
- Use type hints for function parameters
- Include docstrings for complex functions
- Handle exceptions gracefully

### **Error Handling**

Always return TextContent for tool calls:

```python
# Good
try:
    result = risky_operation()
    return [types.TextContent(type="text", text=f"Success: {result}")]
except Exception as e:
    return [types.TextContent(type="text", text=f"Error: {str(e)}")]

# Bad - Don't throw exceptions to AI clients
def bad_tool():
    raise Exception("This will break the MCP client")
```

### **Security Considerations**

1. **File Access**: Always use `safe_read_file()` and `safe_write_file()` with size limits and path validation
2. **Command Execution**: Use `run_command()` with allowlist validation and timeouts
3. **Path Validation**: Use `validate_file_path()` to prevent traversal attacks
4. **Environment Protection**: Use `filter_sensitive_environment()` to prevent credential exposure
5. **API Keys**: Never log or return API keys in responses
6. **Input Validation**: Validate all user inputs before processing

**Required Security Testing**: Before any changes are committed:

```bash
python validate_core_security.py  # Must pass all 6 security tests
python scan_credentials.py        # Must show no credential exposures
```

## 🚀 **Release Process**

### **Version Management**

1. Update version in `pyproject.toml`
2. Update `CHANGELOG.md` with changes
3. Tag release: `git tag v0.2.0`
4. Push tags: `git push --tags`

### **Pre-Release Checklist**

- [ ] All functional tests pass
- [ ] **Security validation passes**: `python validate_core_security.py`
- [ ] **No credentials exposed**: `python scan_credentials.py`
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No secrets in code
- [ ] Scripts work on target platforms
- [ ] **Security guidelines followed**: All new code uses hardened security functions

## 🤝 **Contributing**

### **Pull Request Process**

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-tool`
3. Make changes with tests
4. Update documentation
5. Submit pull request

### **Contribution Types**

- **New Tools**: Add functionality for AI assistants
- **API Integrations**: Connect to new services
- **Bug Fixes**: Improve reliability
- **Documentation**: Enhance user experience
- **Performance**: Optimize speed and memory usage

---

**Need help?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open an issue on GitHub.
