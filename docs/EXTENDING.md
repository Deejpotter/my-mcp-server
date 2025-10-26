# Extending the MCP Server

This guide covers how to extend the MCP server with new tools, resources, and integrations.

## 🎯 **Extension Types**

### **1. Tools (Functions)**

Functions that AI can call to perform actions:

- File operations
- API calls  
- System commands
- Data processing

### **2. Resources (Data Sources)**

Read-only data sources that AI can access:

- Files and directories
- Database queries
- API endpoints
- System information

### **3. External Integrations**

Connections to external services:

- Project management tools
- Documentation systems
- Cloud services
- Development tools

## 🛠️ **Adding New Tools**

### **Basic Tool Template**

```python
# 1. Add to handle_list_tools()
Tool(
    name="my_new_tool",
    description="Clear description of what this tool does",
    inputSchema={
        "type": "object",
        "properties": {
            "required_param": {
                "type": "string",
                "description": "Description of required parameter"
            },
            "optional_param": {
                "type": "integer", 
                "description": "Description of optional parameter",
                "default": 10
            }
        },
        "required": ["required_param"]
    }
)

# 2. Add to handle_call_tool()
elif name == "my_new_tool":
    required_param = arguments.get("required_param", "")
    optional_param = arguments.get("optional_param", 10)
    
    try:
        # Your tool logic here
        result = perform_action(required_param, optional_param)
        return [types.TextContent(type="text", text=f"Success: {result}")]
    except Exception as e:
        return [types.TextContent(type="text", text=f"Error: {str(e)}")]
```

### **File Operation Tools**

Example: Create a tool to count lines in files

```python
Tool(
    name="count_lines",
    description="Count lines in a file or directory",
    inputSchema={
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "File or directory path"
            },
            "include_empty": {
                "type": "boolean",
                "description": "Include empty lines in count",
                "default": True
            }
        },
        "required": ["path"]
    }
)

# Implementation
elif name == "count_lines":
    path = arguments.get("path", "")
    include_empty = arguments.get("include_empty", True)
    
    try:
        path_obj = Path(path).resolve()
        
        if path_obj.is_file():
            content = safe_read_file(str(path_obj))
            lines = content.split('\n')
            if not include_empty:
                lines = [line for line in lines if line.strip()]
            count = len(lines)
            return [types.TextContent(
                type="text", 
                text=f"File {path} has {count} lines"
            )]
        
        elif path_obj.is_dir():
            total_lines = 0
            file_count = 0
            
            for file in path_obj.rglob("*.py"):  # Count Python files
                try:
                    content = safe_read_file(str(file))
                    lines = content.split('\n')
                    if not include_empty:
                        lines = [line for line in lines if line.strip()]
                    total_lines += len(lines)
                    file_count += 1
                except Exception:
                    continue
            
            return [types.TextContent(
                type="text", 
                text=f"Directory {path} has {total_lines} lines across {file_count} Python files"
            )]
        
        else:
            return [types.TextContent(
                type="text", 
                text=f"Path {path} not found"
            )]
            
    except Exception as e:
        return [types.TextContent(
            type="text", 
            text=f"Error counting lines: {str(e)}"
        )]
```

### **System Information Tools**

Example: Get system resource usage

```python
Tool(
    name="system_stats",
    description="Get system resource usage statistics",
    inputSchema={
        "type": "object",
        "properties": {
            "detailed": {
                "type": "boolean",
                "description": "Include detailed information",
                "default": False
            }
        },
        "required": []
    }
)

# Implementation  
elif name == "system_stats":
    detailed = arguments.get("detailed", False)
    
    try:
        import psutil
        import platform
        
        # Basic stats
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        stats = {
            "cpu_usage": f"{cpu_percent}%",
            "memory_usage": f"{memory.percent}%",
            "memory_available": f"{memory.available / (1024**3):.1f} GB",
            "disk_usage": f"{disk.percent}%",
            "disk_free": f"{disk.free / (1024**3):.1f} GB"
        }
        
        if detailed:
            stats.update({
                "platform": platform.platform(),
                "processor": platform.processor(),
                "cpu_count": psutil.cpu_count(),
                "boot_time": datetime.fromtimestamp(psutil.boot_time()).isoformat()
            })
        
        output = "System Statistics:\n\n"
        for key, value in stats.items():
            output += f"{key.replace('_', ' ').title()}: {value}\n"
        
        return [types.TextContent(type="text", text=output)]
        
    except ImportError:
        return [types.TextContent(
            type="text", 
            text="psutil not installed. Run: uv add psutil"
        )]
    except Exception as e:
        return [types.TextContent(
            type="text", 
            text=f"Error getting system stats: {str(e)}"
        )]
```

## 📊 **Adding New Resources**

### **Resource Template**

```python
# 1. Add to handle_list_resources()
Resource(
    uri="custom://my_resource",
    name="My Custom Resource",
    description="Description of what this resource provides",
    mimeType="application/json"  # or "text/plain"
)

# 2. Add to handle_read_resource()
elif uri == "custom://my_resource":
    try:
        data = fetch_my_data()
        if isinstance(data, dict):
            return json.dumps(data, indent=2)
        else:
            return str(data)
    except Exception as e:
        return f"Error fetching resource: {str(e)}"
```

### **Database Resource Example**

```python
# Resource definition
Resource(
    uri="db://tables",
    name="Database Tables",
    description="List of database tables and schemas",
    mimeType="application/json"
)

# Implementation
elif uri == "db://tables":
    try:
        # Example with sqlite
        import sqlite3
        
        db_path = os.getenv("DATABASE_PATH", "app.db")
        if not Path(db_path).exists():
            return json.dumps({"error": "Database not found"})
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get table list
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        table_info = {}
        for table in tables:
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [{"name": row[1], "type": row[2]} for row in cursor.fetchall()]
            table_info[table] = {"columns": columns}
        
        conn.close()
        
        return json.dumps({
            "database": db_path,
            "table_count": len(tables),
            "tables": table_info
        }, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})
```

### **Configuration Resource Example**

```python
# Resource definition
Resource(
    uri="config://settings",
    name="Application Settings",
    description="Current application configuration",
    mimeType="application/json"
)

# Implementation
elif uri == "config://settings":
    try:
        config = {
            "server_name": "my-mcp-server",
            "version": "0.1.0",
            "environment": os.getenv("ENVIRONMENT", "development"),
            "features": {
                "github_integration": bool(os.getenv("GITHUB_TOKEN")),
                "clickup_integration": bool(os.getenv("CLICKUP_API_TOKEN")),
                "bookstack_integration": bool(os.getenv("BOOKSTACK_URL"))
            },
            "security": {
                "api_key_configured": bool(os.getenv("MY_SERVER_API_KEY")),
                "file_size_limit": 1024 * 1024,  # 1MB
                "command_timeout": 30
            }
        }
        
        return json.dumps(config, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)})
```

## 🌐 **External API Integrations**

### **API Integration Template**

```python
# 1. Add environment variables to .env.example
NEW_API_TOKEN=your_api_token_here
NEW_API_BASE_URL=https://api.newservice.com

# 2. Add tools for the service
Tool(
    name="newapi_get_data",
    description="Get data from New API service",
    inputSchema={
        "type": "object", 
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "limit": {"type": "integer", "default": 10}
        },
        "required": ["query"]
    }
)

# 3. Implement the integration
elif name == "newapi_get_data":
    try:
        api_token = os.getenv("NEW_API_TOKEN")
        base_url = os.getenv("NEW_API_BASE_URL", "https://api.newservice.com")
        
        if not api_token:
            return [types.TextContent(
                type="text",
                text="NEW_API_TOKEN not configured. Add to .env file."
            )]
        
        query = arguments.get("query", "")
        limit = arguments.get("limit", 10)
        
        headers = {"Authorization": f"Bearer {api_token}"}
        params = {"q": query, "limit": limit}
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{base_url}/search",
                headers=headers,
                params=params
            )
            
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                
                output = f"Results from New API for '{query}':\n\n"
                for i, result in enumerate(results, 1):
                    output += f"{i}. {result.get('title', 'No title')}\n"
                    if result.get("description"):
                        output += f"   {result['description'][:100]}...\n"
                    output += f"   URL: {result.get('url', 'No URL')}\n\n"
                
                return [types.TextContent(type="text", text=output)]
            else:
                return [types.TextContent(
                    type="text",
                    text=f"API error: {response.status_code} - {response.text}"
                )]
                
    except Exception as e:
        return [types.TextContent(
            type="text",
            text=f"Error calling New API: {str(e)}"
        )]
```

### **Webhook Integration Example**

For services that support webhooks:

```python
Tool(
    name="setup_webhook",
    description="Setup webhook for external service notifications",
    inputSchema={
        "type": "object",
        "properties": {
            "service": {"type": "string", "description": "Service name"},
            "event_type": {"type": "string", "description": "Event type to monitor"},
            "callback_url": {"type": "string", "description": "Webhook callback URL"}
        },
        "required": ["service", "event_type", "callback_url"]
    }
)

elif name == "setup_webhook":
    try:
        service = arguments.get("service", "")
        event_type = arguments.get("event_type", "")
        callback_url = arguments.get("callback_url", "")
        
        # Implementation depends on the service
        # Example for GitHub webhooks:
        if service == "github":
            github_token = os.getenv("GITHUB_TOKEN")
            repo = arguments.get("repository", "")  # Add to schema
            
            headers = {"Authorization": f"token {github_token}"}
            webhook_data = {
                "name": "web",
                "active": True,
                "events": [event_type],
                "config": {
                    "url": callback_url,
                    "content_type": "json"
                }
            }
            
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"https://api.github.com/repos/{repo}/hooks",
                    headers=headers,
                    json=webhook_data
                )
                
                if response.status_code == 201:
                    webhook = response.json()
                    return [types.TextContent(
                        type="text",
                        text=f"✅ Webhook created: {webhook['id']} for {event_type} events"
                    )]
        
        return [types.TextContent(
            type="text",
            text=f"Webhook setup not implemented for service: {service}"
        )]
        
    except Exception as e:
        return [types.TextContent(
            type="text",
            text=f"Error setting up webhook: {str(e)}"
        )]
```

## 🔧 **Advanced Patterns**

### **Tool Chaining**

Create tools that can call other tools:

```python
elif name == "analyze_project":
    try:
        # Chain multiple tools together
        results = {}
        
        # 1. Get project structure
        file_list = await call_internal_tool("list_files", {
            "directory": ".",
            "recursive": True,
            "pattern": "*.py"
        })
        results["files"] = file_list
        
        # 2. Count lines of code
        line_count = await call_internal_tool("count_lines", {
            "path": ".",
            "include_empty": False
        })
        results["line_count"] = line_count
        
        # 3. Check git status
        git_status = await call_internal_tool("git_command", {
            "git_args": "status --porcelain"
        })
        results["git_status"] = git_status
        
        # Combine results
        output = "Project Analysis:\n\n"
        for key, value in results.items():
            output += f"{key.title()}:\n{value}\n\n"
        
        return [types.TextContent(type="text", text=output)]
        
    except Exception as e:
        return [types.TextContent(
            type="text",
            text=f"Error analyzing project: {str(e)}"
        )]
```

### **Caching Results**

Implement caching for expensive operations:

```python
import time
from functools import lru_cache

# Simple in-memory cache
tool_cache = {}

elif name == "cached_api_call":
    try:
        cache_key = f"api_call_{arguments.get('query', '')}"
        cache_ttl = 300  # 5 minutes
        
        # Check cache
        if cache_key in tool_cache:
            cached_data, timestamp = tool_cache[cache_key]
            if time.time() - timestamp < cache_ttl:
                return [types.TextContent(
                    type="text",
                    text=f"[CACHED] {cached_data}"
                )]
        
        # Make API call
        result = await expensive_api_call(arguments)
        
        # Cache result
        tool_cache[cache_key] = (result, time.time())
        
        return [types.TextContent(type="text", text=result)]
        
    except Exception as e:
        return [types.TextContent(
            type="text",
            text=f"Error: {str(e)}"
        )]
```

### **Batch Operations**

Handle multiple items efficiently:

```python
Tool(
    name="batch_file_check",
    description="Check multiple files for issues",
    inputSchema={
        "type": "object",
        "properties": {
            "file_paths": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of file paths to check"
            },
            "check_type": {
                "type": "string",
                "enum": ["syntax", "style", "security"],
                "description": "Type of check to perform"
            }
        },
        "required": ["file_paths", "check_type"]
    }
)

elif name == "batch_file_check":
    try:
        file_paths = arguments.get("file_paths", [])
        check_type = arguments.get("check_type", "syntax")
        
        results = []
        
        for file_path in file_paths:
            try:
                if check_type == "syntax":
                    # Check Python syntax
                    content = safe_read_file(file_path)
                    compile(content, file_path, 'exec')
                    results.append(f"✅ {file_path}: Syntax OK")
                    
                elif check_type == "style":
                    # Basic style checks
                    content = safe_read_file(file_path)
                    issues = []
                    
                    lines = content.split('\n')
                    for i, line in enumerate(lines, 1):
                        if len(line) > 100:
                            issues.append(f"Line {i}: Too long ({len(line)} chars)")
                        if line.rstrip() != line:
                            issues.append(f"Line {i}: Trailing whitespace")
                    
                    if issues:
                        results.append(f"⚠️ {file_path}: {len(issues)} style issues")
                    else:
                        results.append(f"✅ {file_path}: Style OK")
                        
                elif check_type == "security":
                    # Basic security checks
                    content = safe_read_file(file_path)
                    security_issues = []
                    
                    dangerous_patterns = [
                        "eval(", "exec(", "os.system(", "subprocess.call("
                    ]
                    
                    for pattern in dangerous_patterns:
                        if pattern in content:
                            security_issues.append(f"Found {pattern}")
                    
                    if security_issues:
                        results.append(f"🔒 {file_path}: {len(security_issues)} security concerns")
                    else:
                        results.append(f"✅ {file_path}: Security OK")
                        
            except Exception as e:
                results.append(f"❌ {file_path}: Error - {str(e)}")
        
        output = f"Batch {check_type} check results:\n\n"
        output += "\n".join(results)
        
        return [types.TextContent(type="text", text=output)]
        
    except Exception as e:
        return [types.TextContent(
            type="text",
            text=f"Error in batch check: {str(e)}"
        )]
```

## 📝 **Best Practices**

### **1. Error Handling**

- Always return `TextContent`, never raise exceptions
- Provide helpful error messages with context
- Include original error details for debugging

### **2. Input Validation**

- Validate all input parameters
- Use default values where appropriate
- Check for required environment variables

### **3. Security**

- Validate file paths to prevent traversal attacks
- Use timeouts for external API calls
- Never log or return sensitive information

### **4. Performance**

- Implement reasonable size limits
- Use async operations for I/O
- Consider caching for expensive operations

### **5. Documentation**

- Write clear tool descriptions
- Document all parameters thoroughly
- Include usage examples

### **6. Testing**

- Test tools with valid and invalid inputs
- Test error conditions
- Verify output format

---

**Ready to contribute?** See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process.
