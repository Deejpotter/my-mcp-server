# BookStack Tools Testing Guide

This guide provides test cases for the new BookStack creation and update tools.

## Prerequisites

Ensure these environment variables are set in your `.env` file:
- `BOOKSTACK_URL` - Your BookStack instance URL
- `BOOKSTACK_TOKEN_ID` - API token ID from BookStack user profile
- `BOOKSTACK_TOKEN_SECRET` - API token secret from BookStack user profile

**Important**: Restart VS Code or run "MCP: Restart Connection" to load the new tools.

## Test Case 1: Create a Book

```typescript
// Create a new book with name, description, and tags
bookstack_create_book({
  name: "MCP Server User Guide",
  description: "A comprehensive guide to using the MCP Server and its various tools for AI-assisted development.",
  tags: [
    { name: "documentation", value: "mcp" },
    { name: "category", value: "tutorial" }
  ]
})
```

Expected result: Returns book ID and URL for the newly created book.

## Test Case 2: Create a Chapter

```typescript
// Create a chapter in the book (use book_id from previous step)
bookstack_create_chapter({
  name: "Getting Started",
  book_id: <book_id_from_step_1>,
  description: "Introduction to MCP Server installation and configuration.",
  tags: [
    { name: "section", value: "basics" }
  ]
})
```

Expected result: Returns chapter ID and URL for the newly created chapter.

## Test Case 3: Create a Page in Chapter

```typescript
// Create a page with Markdown content in the chapter
bookstack_create_page({
  name: "Installation",
  chapter_id: <chapter_id_from_step_2>,
  markdown: `# Installation Guide

## Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- Git (for git-related tools)

## Steps

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/Deejpotter/my-mcp-server.git
   cd my-mcp-server
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Build the server:
   \`\`\`bash
   npm run build
   \`\`\`

4. Configure environment variables:
   - Copy \`.env.example\` to \`.env\`
   - Add your API keys as needed

## Next Steps

See the Configuration chapter for details on setting up API integrations.
`,
  tags: [
    { name: "topic", value: "setup" }
  ]
})
```

Expected result: Returns page ID and URL with the Markdown content rendered.

## Test Case 4: Create a Page with HTML Content

```typescript
// Create a page directly in the book (not in a chapter)
bookstack_create_page({
  name: "Quick Reference",
  book_id: <book_id_from_step_1>,
  html: `<h1>Quick Reference</h1>
<h2>Common Commands</h2>
<ul>
  <li><strong>Build:</strong> <code>npm run build</code></li>
  <li><strong>Dev Mode:</strong> <code>npm run dev</code></li>
  <li><strong>Type Check:</strong> <code>npm run typecheck</code></li>
</ul>
<h2>Important Files</h2>
<ul>
  <li><code>src/server.ts</code> - Main server entry point</li>
  <li><code>src/tools/</code> - Tool implementations</li>
  <li><code>AI-PROMPT.md</code> - AI assistant guidelines</li>
</ul>`,
  tags: [
    { name: "type", value: "reference" }
  ]
})
```

Expected result: Returns page ID and URL with the HTML content rendered.

## Test Case 5: Update a Book

```typescript
// Update the book's description
bookstack_update_book({
  book_id: <book_id_from_step_1>,
  description: "The complete guide to using MCP Server - covering installation, configuration, and all available tools for AI-assisted development workflows."
})
```

Expected result: Returns updated book details with new description.

## Test Case 6: Update a Page

```typescript
// Update a page's content and move it to a different chapter
bookstack_update_page({
  page_id: <page_id_from_step_3>,
  markdown: `# Installation Guide - Updated

## Prerequisites

- **Node.js 18 or higher** (LTS recommended)
- **npm** (comes with Node.js)
- **Git** (for git-related tools)
- **VS Code** (recommended IDE)

## Installation Steps

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/Deejpotter/my-mcp-server.git
   cd my-mcp-server
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Build the server:
   \`\`\`bash
   npm run build
   \`\`\`

4. Configure environment variables:
   - Copy \`.env.example\` to \`.env\`
   - Add your API keys as needed

## Verification

Run the server to verify installation:
\`\`\`bash
npm start
\`\`\`

You should see: "MCP Server started successfully" in the console.

## Next Steps

- See the Configuration chapter for API integration setup
- Review the Available Tools section for feature overview
- Check out the Prompts guide for workflow automation
`,
  tags: [
    { name: "topic", value: "setup" },
    { name: "status", value: "updated" }
  ]
})
```

Expected result: Returns updated page details with new content and tags.

## Test Case 7: Search for Created Content

```typescript
// Search for the content we created
bookstack_search({
  query: "MCP Server installation",
  count: 10
})
```

Expected result: Returns search results including our newly created book and pages.

## Test Case 8: Retrieve Book Structure

```typescript
// Get the full book structure to see all chapters and pages
bookstack_get_book({
  book_id: <book_id_from_step_1>
})
```

Expected result: Returns complete book details with table of contents showing all chapters and pages.

## Test Case 9: Retrieve Page Content

```typescript
// Get the full content of a page
bookstack_get_page({
  page_id: <page_id_from_step_3>
})
```

Expected result: Returns page content in both HTML and Markdown formats (if available).

## Success Criteria

All test cases should:
- Return successful responses without errors
- Create/update content as expected
- Maintain proper parent-child relationships (book → chapter → page)
- Handle tags correctly
- Support both HTML and Markdown content
- Provide accurate search results

## Troubleshooting

If you encounter errors:

1. **Authentication errors**: Verify your BookStack credentials in `.env`
2. **Permission errors**: Ensure your API token has "Access System API" permission
3. **Rate limit errors**: Wait a few seconds between requests
4. **Not found errors**: Check that parent IDs (book_id, chapter_id) are correct
5. **Tool not found errors**: Restart VS Code or MCP connection to load new tools
