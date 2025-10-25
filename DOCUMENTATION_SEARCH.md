# 📚 Documentation Search Tools

Your MCP server now includes powerful documentation search capabilities! Search across multiple online sources and get instant access to documentation, code examples, and technical resources.

## 🔍 **New Documentation Search Tools**

### **1. Online Documentation Search (`search_docs_online`)**
Search across multiple documentation sources simultaneously:
- **Stack Overflow** - Community Q&A and solutions
- **GitHub** - Repository documentation and READMEs  
- **MDN Web Docs** - Web development documentation
- **DevDocs.io** - Comprehensive API references

**Examples:**
- "Search online docs for React hooks"
- "Find Stack Overflow solutions for Python async"
- "Search GitHub for FastAPI examples"

### **2. Context7 Integration (`context7_search`)**
Intelligent documentation search using Context7 API:
- Library-specific documentation search
- Contextual results with code examples
- Fallback to official documentation sites

**Examples:**
- "Search Context7 for React useState documentation"
- "Find TypeScript interface examples in Context7"
- "Get FastAPI request validation docs from Context7"

### **3. GitHub Code Search (`github_search_code`)**
Search actual code implementations across GitHub:
- Filter by programming language
- Search specific repositories
- Find real-world usage examples

**Examples:**
- "Search GitHub code for MCP server implementations"
- "Find Python asyncio examples on GitHub"
- "Search TypeScript React components"

### **4. DevDocs Search (`devdocs_search`)**
Quick access to DevDocs.io documentation:
- Comprehensive API references
- Multiple programming languages
- Fast, searchable documentation

**Examples:**
- "Search DevDocs for JavaScript Array methods"
- "Find Python asyncio documentation"
- "Get CSS flexbox reference from DevDocs"

## ⚙️ **Setup Instructions**

### **Optional GitHub Token (Recommended)**
For enhanced GitHub search capabilities:

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ `public_repo` (for searching public repositories)
4. Copy your token

Add to your `.env` file:
```env
GITHUB_TOKEN=ghp_your_actual_github_token_here
```

## 🚀 **Usage Examples**

### **Natural Language Queries with Copilot:**

**General Documentation:**
- "Search for React hooks documentation online"
- "Find Python asyncio examples and tutorials"
- "Look up CSS Grid documentation"

**Specific Library Search:**
- "Search Context7 for FastAPI request validation"
- "Get TypeScript interface documentation"
- "Find React router examples"

**Code Examples:**
- "Search GitHub for MCP server implementations in Python"
- "Find asyncio websocket examples"
- "Show me React custom hook implementations"

**API References:**
- "Get JavaScript fetch API documentation from DevDocs"
- "Find Python requests library documentation"
- "Look up CSS animation properties"

### **Direct Tool Usage:**

```bash
# Search multiple sources
"Search online documentation for 'React useState' from all sources"

# Context7 library search  
"Search Context7 for 'authentication' in the 'fastapi' library"

# GitHub code search
"Search GitHub code for 'mcp server' in Python language"

# DevDocs reference
"Search DevDocs for 'array methods' in JavaScript docs"
```

## 🎯 **Search Strategy Tips**

### **For Learning New Concepts:**
1. Start with **Context7** for official documentation
2. Use **online search** for community solutions
3. Check **GitHub code** for real implementations
4. Reference **DevDocs** for API details

### **For Debugging Issues:**
1. Search **Stack Overflow** first for known solutions
2. Look at **GitHub code** for similar implementations
3. Check **official docs** via Context7 or DevDocs

### **For Implementation Examples:**
1. **GitHub code search** for real-world usage
2. **Context7** for official examples
3. **Stack Overflow** for common patterns

## 🔧 **Search Parameters**

### **Online Documentation Search:**
- `source`: "mdn", "stackoverflow", "github", "all" (default: "all")
- `limit`: Number of results (default: 5)

### **Context7 Search:**
- `library`: Target library/framework name
- `tokens`: Maximum response tokens (default: 5000)

### **GitHub Code Search:**
- `language`: Programming language filter
- `repo`: Specific repository (format: "owner/repo")
- `limit`: Number of results (default: 5)

### **DevDocs Search:**
- `docs`: Specific documentation set (e.g., "javascript", "python~3.11")

## 🌟 **Benefits**

✅ **Comprehensive Coverage** - Search multiple sources simultaneously  
✅ **Contextual Results** - Library-specific documentation via Context7  
✅ **Real Code Examples** - Actual implementations from GitHub  
✅ **Fast API References** - Quick access via DevDocs  
✅ **Community Solutions** - Stack Overflow integration  
✅ **No Context Switching** - All research within VS Code  

## 🚨 **Rate Limits & Best Practices**

- **GitHub API**: 60 requests/hour without token, 5000/hour with token
- **Stack Overflow**: Generally permissive for reasonable usage
- **MDN/DevDocs**: No strict limits, but be respectful
- **Context7**: Depends on your API access level

**Recommendations:**
- Use GitHub token for better rate limits
- Cache frequently accessed documentation locally
- Combine multiple search strategies for comprehensive results
- Use specific queries for better results

## 🔄 **Integration with Existing Tools**

Your documentation search tools work seamlessly with your other MCP tools:
- **Save findings** to BookStack pages
- **Create ClickUp tasks** for documentation todos
- **Search local files** to compare with online examples
- **Fetch URLs** for deeper documentation dive

**Example Workflow:**
1. "Search Context7 for FastAPI authentication"
2. "Create a BookStack page with this authentication guide"
3. "Create a ClickUp task to implement OAuth in our API"

Enjoy your enhanced documentation research capabilities! 📖✨