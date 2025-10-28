# AI Prompt for MCP Server Development

## **Overview**

This document provides comprehensive guidance for AI assistants working on **my-mcp-server**, a Model Context Protocol (MCP) server. This is a **personal project** focused on practical development tools and API integrations for AI assistants in VS Code. Remember to keep it simple and practical, avoiding unnecessary complexity. And, always search for official docs for the libraries/APIs being used before changing anything.

**Quick Reference**: Before making ANY changes, you MUST:

1. Read this AI-PROMPT.md file completely
2. Check TODO.md for current priorities
3. Review relevant documentation in docs/ folder
4. Create a detailed checklist before implementing
5. Use my-mcp-server tools to search official documentation
6. Update core files (README.md, TODO.md, docs/) after changes

## **Table of Contents**

1. [Project Context](#project-context) - Project overview, structure, and architecture philosophy
2. [Development Workflow & File Management](#development-workflow--file-management) - Pre-work analysis, file management, planning, and TODO tracking
3. [Code Standards & Documentation](#code-standards--documentation) - File headers, documentation philosophy, research requirements, and comment examples
4. [Technical Implementation](#technical-implementation) - Tool development patterns, implementation standards, error handling, and API integration
5. [Communication & Documentation Style](#communication--documentation-style) - Tone, voice, and documentation standards
6. [Expected AI Assistance Style](#expected-ai-assistance-style) - Before starting work, when helping with code, discussing architecture, and after making changes
7. [Current Project Priorities](#current-project-priorities) - Immediate focus, quality standards, and avoiding over-engineering

**Key Principle**: This is a **single-file architecture** (main.py) personal project. Preserve existing code, add detailed comments from the author's perspective, and always reference official documentation.

---

```text
Project Structure
```

## **Project Context**

You are working on **my-mcp-server**, a Model Context Protocol (MCP) server that provides development tools and API integrations for AI assistants. This is a **personal project** with 1-2 contributors, focused on practical utility over enterprise features.

### **Project Structure**

```text
my-mcp-server/
├── main.py                    # Core MCP server
├── TODO.md                    # Track planned features and improvements
├── scripts/                   # Setup utilities
├── docs/                      # Comprehensive documentation
└── vscode-extension/          # Auto-registration for VS Code
```

### **Architecture Philosophy**

- **Single-file simplicity**: Everything in `main.py` for easy maintenance
- **Security-first**: Input validation, timeouts, file size limits
- **Extensible patterns**: Clear MODIFICATION POINTs for adding tools
- **Local development focus**: stdio transport for VS Code integration

## **Development Workflow & File Management**

### **Pre-Work Analysis Requirements**

Before making any changes, always:

1. **Check core project files**: README.md, AI-PROMPT.md, TODO.md
2. **Review relevant docs/ folder files**: API-INTEGRATIONS.md, DEVELOPMENT.md, etc.
3. **Analyze existing code patterns**: Understand current implementation before suggesting changes
4. **Use my-mcp-server tools**: Search for official documentation using built-in tools
5. **Search online**: For information not available in official documentation

### **File Management Philosophy**

- **Improve existing files over creating new ones**: Update and enhance current files rather than replacing
- **Preserve current code and comments**: Keep my existing code wherever possible
- **Add detailed comments from my perspective**: Explain code purpose from the original author's viewpoint
- **Update core files**: Always update README.md, AI-PROMPT.md, TODO.md, and relevant docs/ when finding new information

### **Planning and Execution**

- **Create detailed plans**: Consider how to find best actions, then make a comprehensive plan
- **Remember and reference plans**: Refer back to the plan regularly to ensure staying on track
- **Follow the plan**: Make changes systematically according to the planned approach

### **TODO.md Management**

The TODO.md file serves to track current state of changes and progress:

- **Mark current work**: Use "(in progress)" for active tasks
- **Mark completion**: Use "(completed)" for finished tasks  
- **Check before/after**: Review TODO.md before starting and update after changes
- **Track state accurately**: Reflect the real status of project development

## **Code Standards & Documentation**

### **File Header Standards**

Every file must start with this exact header structure:

```python
"""
Updated: current date structured as dd/mm/yy
By: Daniel Potter

Description of the purpose of the file and anything that's really important to know to work with the file.

References:
Important reference: https://importantreference.com/important-part
Another reference: https://docs.example.com/relevant-section
"""
```

**Key Requirements:**

- **Date format**: Always dd/mm/yy format for consistency
- **Author**: Daniel Potter (or contributing author)
- **Description**: Concise purpose and critical working knowledge
- **References**: Link technical decisions to official documentation

### **Code Documentation & Organization Philosophy**

- **Preserve existing code**: Keep current code and comments wherever possible
- **Add detailed comments from author perspective**: Explain purpose and reasoning from original developer viewpoint
- **Concise but descriptive comments**: Each action needs explanation of purpose and logic behind choices
- **Reference-backed decisions**: All technical choices must link to official documentation
- **Why over what**: Comments explain reasoning, not just describe the code
- **Consistent patterns**: Follow existing tool/resource implementation patterns
- **Practical over perfect**: Favor working solutions over theoretical elegance
- **No visual decorations**: Avoid emoji in code, focus on clarity

### **Research and Documentation Requirements**

When researching or making technical decisions:

1. **Use my-mcp-server tools first**: Search for official documentation using built-in search tools
2. **Search online for gaps**: Find information not available in official docs
3. **Add comment explaining the choice**: Brief rationale for the approach
4. **Reference official documentation**: Link to specific docs section
5. **Update file References section**: Add new documentation URLs to file header
6. **Explain alternatives considered**: Why this choice over others

### **Comment Examples**

```python
# Use asyncio.create_task() for concurrent API calls - improves response time
# Reference: https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task
task = asyncio.create_task(fetch_data())

# HTTPx chosen over requests for async support in MCP servers
# Reference: https://www.python-httpx.org/async/
async with httpx.AsyncClient(timeout=30) as client:
    response = await client.get(url)
```

## **Technical Implementation**

### **Tool Development Pattern**

1. **Schema Definition**: Clear descriptions, required vs optional parameters
2. **Error Handling**: Always return `TextContent`, never raise exceptions
3. **Input Validation**: Check parameters, provide helpful error messages
4. **Security**: Validate file paths, use timeouts, respect size limits

### **Tool Implementation Standards**

- **Descriptive names**: `github_search_code` not `gh_search`
- **Comprehensive schemas**: Document all parameters with examples
- **Graceful degradation**: Handle missing dependencies, provide alternatives
- **Performance awareness**: Consider timeouts, caching, size limits

### **Error Handling Philosophy**

```python
# Always return TextContent, never raise exceptions - MCP requirement
# Reference: https://modelcontextprotocol.io/docs/concepts/tools
try:
    result = do_something()
    return [types.TextContent(type="text", text=f"Success: {result}")]
except Exception as e:
    return [types.TextContent(type="text", text=f"Error: {str(e)}")]
```

### **API Integration Pattern**

- **Environment variables**: Store tokens in `.env`, never hardcode
- **Async HTTP**: Use `httpx.AsyncClient` with timeout
- **Helpful errors**: Guide users to fix configuration issues
- **Optional features**: Gracefully handle missing API keys

## **Communication & Documentation Style**

### **Tone & Voice**

- **Professional but approachable**: Technical accuracy with beginner friendly explanations
- **Concise and actionable**: Get to the point, provide next steps
- **Problem-solving focused**: Address the "why" behind decisions
- **Organized presentation**: Use headers, lists, code blocks effectively

### **Documentation Standards**

- **Plain text navigation**: Use clear headings without visual decorations
- **Clear hierarchies**: ## for main sections, ### for subsections
- **Code examples**: Always include working examples, not placeholders
- **Practical focus**: Real-world usage over theoretical concepts
- **Reference linking**: Connect technical decisions to official documentation
- **Topic-focused files**: API-INTEGRATIONS.md, TROUBLESHOOTING.md, etc.
- **Comprehensive examples**: Real code snippets, not pseudocode
- **Cross-references**: Link between related documentation sections
- **User-friendly**: Step-by-step instructions, troubleshooting sections

## **Expected AI Assistance Style**

### **Before Starting Work**

1. **Check core project files**: README.md, AI-PROMPT.md, TODO.md
2. **Review relevant documentation**: docs/ folder files as needed
3. **Create detailed plan**: Consider best actions, make comprehensive plan
4. **Reference plan regularly**: Stay on track with planned approach

### **When Helping with Code**

1. **Preserve existing code**: Keep current code and comments where possible
2. **Add detailed comments**: From original author's perspective explaining purpose
3. **Follow single-file architecture**: Don't suggest file splits for main.py
4. **Include complete examples**: With error handling and explanatory comments
5. **Add file headers**: Use required format for any new files
6. **Update References section**: When introducing new technical concepts
7. **Use my-mcp-server tools**: Search for official documentation first
8. **Search online**: For information not in official docs
9. **Always use context7**: Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

### **When Discussing Architecture**

- **Respect MCP protocol constraints**: Tools/resources model limitations
- **Consider local vs remote usage**: Patterns and requirements
- **Focus on VS Code integration**: Primary use case
- **Balance features vs simplicity**: Personal project scale

### **After Making Changes**

1. **Update core files**: README.md, AI-PROMPT.md, TODO.md as needed
2. **Update docs/ folder**: Relevant documentation files
3. **Mark TODO.md progress**: (in progress) for active work, (completed) for finished tasks
4. **Test changes**: Use JSON-RPC test commands before finishing

## **Current Project Priorities**

### **Quality Standards**

- **Test before committing**: Use JSON-RPC test commands
- **Update documentation**: Keep docs/ files current with changes
- **Security review**: Validate all user inputs, use safe defaults
- **Performance check**: Consider impact of new tools on startup time

### **Avoid Over-Engineering**

- No excess documents or scripts (personal project scale)
- Keep documentation focused and practical
- Prefer markdown checklists over complex project management
