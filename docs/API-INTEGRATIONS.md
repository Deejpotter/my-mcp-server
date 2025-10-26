# API Integrations

This document covers how to configure and use the various API integrations available in the MCP server.

## 🔧 **Environment Setup**

Create a `.env` file in the project root with your API credentials:

```env
# GitHub API Configuration (Optional - for enhanced search results)
# Create a personal access token at: https://github.com/settings/tokens
# Only needs 'public_repo' scope for searching public repositories
GITHUB_TOKEN=ghp_your_github_token_here

# ClickUp API Configuration
# Get your API token from: https://app.clickup.com/settings/apps
CLICKUP_API_TOKEN=pk_your_clickup_api_token_here

# BookStack API Configuration  
# Create API tokens in BookStack Settings > API Tokens
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_token_id_here
BOOKSTACK_TOKEN_SECRET=your_token_secret_here
```

## 📂 **GitHub Integration**

### **Setup**

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Create token with `public_repo` scope
3. Add to `.env`: `GITHUB_TOKEN=ghp_your_token_here`

### **Benefits**

- Higher rate limits (5000/hour vs 60/hour)
- Access to private repositories (if needed)
- Enhanced search capabilities

### **Available Tools**

- **`github_search_code`** - Search GitHub repositories for code examples
  - Query: Search terms for code
  - Language: Filter by programming language
  - Repository: Search specific repo (owner/repo format)
  - Limit: Number of results to return

**Example Usage:**

```json
{
  "query": "MCP server implementation",
  "language": "python",
  "limit": 5
}
```

## � **Context7 Integration**

### **Setup**

Context7 provides up-to-date documentation for libraries and frameworks. The server includes a built-in `context7_search` tool.

**Option 1: No API Key (Limited)**

- Works without setup but has rate limits
- Basic documentation search functionality

**Option 2: With API Key (Enhanced)**

1. Visit [Context7.com](https://context7.com) and create an account
2. Generate an API key from your dashboard
3. Add to `.env`: `CONTEXT7_API_KEY=your_api_key_here`

### **Available Tools**

#### **`context7_search`**

Search documentation for specific libraries/frameworks with up-to-date information.

- **library** (required): Library name (e.g., 'react', 'typescript', 'python', 'fastapi')
- **query** (required): Search query within the library documentation  
- **tokens** (optional): Maximum tokens to retrieve (default: 5000)

**Example Usage:**

```json
{
  "library": "fastapi",
  "query": "async routes middleware",
  "tokens": 3000
}
```

### **Benefits**

- **Up-to-date documentation**: Directly from source repositories
- **Version-specific information**: Avoid outdated or deprecated examples
- **Code examples included**: Real implementation snippets
- **Multiple libraries**: Covers popular frameworks and libraries

### **Testing Context7**

```bash
# Test Context7 search (works without API key)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"context7_search","arguments":{"library":"python","query":"async await examples","tokens":2000}}}' | uv run my-mcp-server
```

## �📋 **ClickUp Integration**

### **Setup**

1. Go to [ClickUp Settings > Apps](https://app.clickup.com/settings/apps)
2. Create new API token
3. Add to `.env`: `CLICKUP_API_TOKEN=pk_your_token_here`

### **Finding IDs**

- **List ID:** From URL `https://app.clickup.com/123456/v/li/987654321` → `987654321`
- **Workspace ID:** From API or workspace settings

### **Available Tools**

#### **`clickup_get_workspaces`**

Get all accessible workspaces for your account.

#### **`clickup_get_tasks`**

Get tasks from a specific list.

- **list_id** (required): ClickUp List ID
- **status** (optional): Filter by task status
- **assignee** (optional): Filter by assignee user ID

#### **`clickup_create_task`**

Create a new task in ClickUp.

- **list_id** (required): ClickUp List ID
- **name** (required): Task title
- **description** (optional): Task description
- **priority** (optional): urgent, high, normal, low
- **assignees** (optional): Array of user IDs

**Example Usage:**

```json
{
  "list_id": "123456789",
  "name": "Fix MCP server bug",
  "description": "The server crashes when handling large files",
  "priority": "high",
  "assignees": ["987654321"]
}
```

## 📚 **BookStack Integration**

### **Setup**

1. Go to BookStack Settings > API Tokens
2. Create new token with appropriate permissions
3. Add credentials to `.env`

### **Available Tools**

#### **`bookstack_search`**

Search for content across your BookStack instance.

- **query** (required): Search terms
- **type** (optional): page, book, chapter, or all
- **count** (optional): Number of results (default: 10)

#### **`bookstack_get_page`**

Get content from a specific page.

- **page_id** (required): BookStack page ID

#### **`bookstack_create_page`**

Create a new page in BookStack.

- **book_id** (required): BookStack book ID
- **name** (required): Page title
- **html** (optional): Page content in HTML
- **markdown** (optional): Page content in Markdown

**Example Usage:**

```json
{
  "book_id": "42",
  "name": "MCP Server Configuration",
  "markdown": "# Configuration\n\nThis page covers MCP server setup..."
}
```

## 🔍 **Documentation Search**

### **Multiple Source Search (`search_docs_online`)**

Search across multiple documentation sources simultaneously:

- **Stack Overflow**: Community Q&A and solutions
- **GitHub**: Repository documentation and READMEs  
- **MDN Web Docs**: Authoritative web development docs

**Example Usage:**

```json
{
  "query": "async await best practices",
  "source": "all",
  "limit": 5
}
```

### **DevDocs Search (`devdocs_search`)**

Quick API reference lookup using DevDocs.io:

- **query** (required): Documentation search terms
- **docs** (optional): Specific documentation set (e.g., 'javascript', 'python~3.11')

### **Context7 Search (`context7_search`)**

AI-powered library-specific documentation search:

- **library** (required): Library name (e.g., 'react', 'fastapi')
- **query** (required): Search query within library docs
- **tokens** (optional): Maximum tokens to retrieve

## 🔧 **Adding New API Integrations**

### **1. Environment Variables**

Add new API credentials to `.env.example` and your local `.env`:

```env
# New Service API Configuration
NEW_SERVICE_API_KEY=your_api_key_here
NEW_SERVICE_BASE_URL=https://api.newservice.com
```

### **2. Tool Definition**

Add a new tool in `main.py` `handle_list_tools()`:

```python
Tool(
    name="newservice_action",
    description="Perform action with new service",
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

### **3. Tool Implementation**

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

### **4. Error Handling**

Always include proper error handling:

- Check for required environment variables
- Validate input parameters
- Handle API rate limits and timeouts
- Return user-friendly error messages

### **5. Documentation**

Update this file with:

- Setup instructions
- Tool descriptions
- Example usage
- Common troubleshooting tips

## 🚨 **Troubleshooting**

### **Common Issues**

**API Rate Limits:**

- GitHub: Use personal access token for higher limits
- ClickUp: Implement request caching if needed
- BookStack: Check API permissions

**Authentication Errors:**

- Verify API keys are correctly set in `.env`
- Check token permissions/scopes
- Ensure API endpoints are accessible

**Connection Timeouts:**

- Check internet connectivity
- Verify API service status
- Increase timeout values if needed

### **Testing API Connections**

Test individual APIs using the MCP server:

```bash
# Test GitHub (requires token)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"github_search_code","arguments":{"query":"hello world","language":"python","limit":1}}}' | uv run my-mcp-server

# Test ClickUp (requires token)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"clickup_get_workspaces","arguments":{}}}' | uv run my-mcp-server
```

## 📝 **Best Practices**

1. **Security**: Never commit API keys to version control
2. **Rate Limiting**: Implement caching for frequently accessed data
3. **Error Handling**: Provide clear, actionable error messages
4. **Documentation**: Keep API documentation up-to-date
5. **Testing**: Test API integrations regularly

---

**Need help?** Check the main [README.md](../README.md) or [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for additional support.
