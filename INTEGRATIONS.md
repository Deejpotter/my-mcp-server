# 🔗 ClickUp & BookStack Integration

Your MCP server now supports ClickUp and BookStack integrations! Here's how to set them up:

## 🎯 **New MCP Tools Available**

### **ClickUp Tools:**
- **`clickup_get_workspaces`** - List all your ClickUp workspaces
- **`clickup_get_tasks`** - Get tasks from a specific list (with filters)
- **`clickup_create_task`** - Create new tasks

### **BookStack Tools:**
- **`bookstack_search`** - Search for pages, books, or chapters
- **`bookstack_get_page`** - Get content of a specific page
- **`bookstack_create_page`** - Create new pages

## ⚙️ **Setup Instructions**

### **1. ClickUp Setup**
1. Go to [ClickUp Settings > Apps](https://app.clickup.com/settings/apps)
2. Create a new API token
3. Copy your token

### **2. BookStack Setup**
1. Log into your BookStack instance
2. Go to Settings > API Tokens
3. Create a new API token
4. Note down the Token ID and Token Secret

### **3. Configure Environment Variables**
Create a `.env` file in your MCP server directory:

```bash
cp .env.example .env
nano .env
```

Fill in your credentials:
```env
# ClickUp API Configuration
CLICKUP_API_TOKEN=pk_your_actual_clickup_token_here

# BookStack API Configuration  
BOOKSTACK_URL=https://your-bookstack-instance.com
BOOKSTACK_TOKEN_ID=your_actual_token_id
BOOKSTACK_TOKEN_SECRET=your_actual_token_secret
```

## 🚀 **Usage Examples**

### **ClickUp Examples:**
- "Show me all my ClickUp workspaces"
- "Get tasks from ClickUp list 123456789"
- "Create a new task called 'Review MCP integration' in list 123456789"
- "Get high priority tasks assigned to me"

### **BookStack Examples:**
- "Search BookStack for 'API documentation'"
- "Get the content of BookStack page 42"
- "Create a new page called 'MCP Integration Guide' in book 5"
- "Search for pages about 'deployment'"

## 🔧 **Finding IDs**

### **ClickUp List IDs:**
- Go to your ClickUp list
- Look at the URL: `https://app.clickup.com/123456/v/li/987654321`
- The List ID is `987654321`

### **BookStack Book/Page IDs:**
- Go to your BookStack book or page
- Look at the URL: `https://bookstack.example.com/books/my-book/page/my-page`
- Or use the search tool to find IDs

## 🛡️ **Security Notes**
- Keep your `.env` file private (it's already in `.gitignore`)
- Use read-only tokens when possible
- BookStack tokens can be scoped to specific permissions

## 🔄 **Restart Required**
After setting up your `.env` file, restart VS Code for the MCP server to load the new environment variables.

Enjoy your enhanced productivity with ClickUp and BookStack integration! 🎉