# MCP Prompts Implementation Plan - REVISED (Quality Focus)

**Date**: 02 November 2025
**Goal**: Add 5-7 high-quality, workflow-focused prompts to the MCP server
**Effort**: 2-3 hours total

## Philosophy Change

**Original Plan**: 20+ prompts across 8 files (quantity-focused)
**Revised Plan**: 5-7 prompts in 1 file (quality-focused)

**Why**: Research shows the best MCP servers have fewer, better prompts that guide real workflows rather than simple template filling.

## Research Findings

From studying production MCP servers:

1. **Next.js DevTools MCP**: 2-3 focused workflow prompts (upgrade guides, cache setup)
2. **Claude Prompts MCP**: Rich templates with system/user message separation
3. **Code Reasoning**: Structured thinking prompts with clear purpose

**Key Pattern**: Each prompt has:

- Clear system message (sets context for Claude)
- Detailed user message template (guides the interaction)
- Optional arguments for customization
- Real workflow value (not just "fill in this template")

## Proposed Prompts (5-7 Total)

### 1. **code_review_guide**

**Purpose**: Guide through systematic code review
**System**: "You are an expert code reviewer..."
**User Template**: Step-by-step review checklist with quality, security, performance checks
**Arguments**: `language`, `focus_areas` (optional)
**Value**: Provides structured thinking framework, not just "review this code"

### 2. **commit_message_composer**

**Purpose**: Create meaningful commit messages from git status
**System**: "You are a git commit message expert following conventional commits..."
**User Template**: Analyze changes, suggest type (feat/fix/docs), create descriptive message
**Arguments**: None (uses `git_command` tool to get status)
**Value**: Integrates with existing git tool, guides best practices

### 3. **library_research_workflow**

**Purpose**: Guide systematic library/framework research
**System**: "You are a technical researcher helping evaluate libraries..."
**User Template**: Multi-step research process (purpose → search → documentation → examples → decision)
**Arguments**: `library_name`, `use_case`
**Value**: Orchestrates Context7 + search tools in a proven workflow

### 4. **bug_investigation_guide**

**Purpose**: Structured debugging methodology
**System**: "You are a debugging expert using systematic problem-solving..."
**User Template**: Problem statement → reproduction → hypothesis → investigation → solution
**Arguments**: `error_description`, `context`
**Value**: Applies proven debugging framework, integrates with file/command tools

### 5. **feature_implementation_plan**

**Purpose**: Break down feature into implementation steps
**System**: "You are a software architect planning feature implementation..."
**User Template**: Requirements → architecture → file changes → testing → documentation
**Arguments**: `feature_description`, `constraints` (optional)
**Value**: Provides project planning structure, connects to existing tools

### 6. **documentation_writer** (Optional)

**Purpose**: Generate comprehensive documentation
**System**: "You are a technical writer creating clear, useful documentation..."
**User Template**: Analyze code → identify key concepts → create structured docs
**Arguments**: `doc_type` (API/guide/tutorial), `audience`
**Value**: Systematic documentation approach

### 7. **security_audit_checklist** (Optional)

**Purpose**: Security review workflow
**System**: "You are a security engineer performing code audit..."
**User Template**: OWASP-based checklist for common vulnerabilities
**Arguments**: `language`, `framework` (optional)
**Value**: Structured security thinking

## Implementation Approach

### Single File: `src/prompts/prompts.ts`

```typescript
/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * MCP Prompts for workflow guidance.
 * Each prompt provides structured thinking and tool orchestration.
 *
 * References:
 * MCP Prompts Spec: https://modelcontextprotocol.io/docs/concepts/prompts
 * Next.js DevTools MCP: https://github.com/vercel/next-devtools-mcp
 * Claude Prompts MCP: https://github.com/minipuft/claude-prompts-mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer) {
  // Prompt 1: code_review_guide
  server.registerPrompt(
    "code_review_guide",
    {
      description: "Systematic code review workflow with quality, security, and performance checks",
      arguments: [
        {
          name: "language",
          description: "Programming language (e.g., 'typescript', 'python')",
          required: false
        },
        {
          name: "focus_areas",
          description: "Specific areas to focus on (e.g., 'security', 'performance')",
          required: false
        }
      ]
    },
    async (args?: Record<string, unknown>) => {
      const language = (args?.language as string) || "the code";
      const focus = (args?.focus_areas as string) || "all aspects";
      
      return [
        {
          type: "text" as const,
          text: `You are an expert code reviewer with deep knowledge of software engineering best practices. Your role is to provide constructive, actionable feedback that improves code quality, security, and maintainability.`
        },
        {
          type: "text" as const,
          text: `# Code Review Workflow

## Step 1: Initial Assessment
- Read through the code to understand its purpose and structure
- Identify the main components and their relationships
- Note any immediate concerns or questions

## Step 2: Quality Review (${language})
- **Readability**: Is the code easy to understand?
- **Naming**: Are variables, functions, and classes well-named?
- **Structure**: Is the code well-organized with clear separation of concerns?
- **Comments**: Are complex sections explained? Are comments up-to-date?
- **Error Handling**: Are errors handled appropriately?

## Step 3: Security Review (Focus: ${focus})
- **Input Validation**: Is user input properly validated and sanitized?
- **Authentication/Authorization**: Are security checks in place?
- **Data Exposure**: Is sensitive data protected?
- **Dependencies**: Are third-party packages secure and up-to-date?
- **Common Vulnerabilities**: Check OWASP Top 10 relevant to the language

## Step 4: Performance Review
- **Algorithms**: Are efficient algorithms used?
- **Database Queries**: Are queries optimized (if applicable)?
- **Caching**: Could caching improve performance?
- **Resource Management**: Are resources (connections, files) properly managed?

## Step 5: Testing & Maintainability
- **Test Coverage**: Are critical paths tested?
- **Edge Cases**: Are edge cases handled?
- **Technical Debt**: Are there quick wins to reduce debt?
- **Documentation**: Is the code self-documenting or properly documented?

## Step 6: Specific Recommendations
Provide 3-5 specific, actionable improvements with:
1. **Location**: Where in the code
2. **Issue**: What needs improvement
3. **Suggestion**: How to improve it
4. **Priority**: High/Medium/Low

Use the available tools to examine code files if needed:
- read_file: Read specific files for detailed review
- list_files: Understand project structure
- search_code: Find patterns or potential issues`
        }
      ];
    }
  );

  // Prompt 2: commit_message_composer
  // ... similar structure for other prompts
  
  // Continue with prompts 3-7
}
```

## Implementation Steps

### Step 1: Create Single Prompt File (1 hour)

- Create `src/prompts/prompts.ts`
- Implement all 5-7 prompts with proper structure
- Each prompt: system message + detailed user message template
- Follow file header standards

### Step 2: Integration (15 minutes)

- Import and register in `server.ts`:

```typescript
import { registerPrompts } from "./prompts/prompts.js";
registerPrompts(server);
```

### Step 3: Build & Test (30 minutes)

- `npm run build` - verify TypeScript compilation
- Manual testing via mcp.json configuration
- Verify each prompt appears and provides useful guidance

### Step 4: Documentation (45 minutes)

- **README.md**: Add "Available Prompts" section
  - List each prompt with description and use case
  - Provide examples of when to use each
  - Show how prompts integrate with tools
- **TODO.md**: Mark Phase 4.5 complete
- **AI-PROMPT.md**: Add "Prompt Development" section with patterns

## Success Criteria

✅ **Must Have**:

1. 5 core prompts implemented and working
2. Each prompt provides genuine workflow value
3. Clean TypeScript with no errors
4. Comprehensive documentation in README
5. All prompts discoverable via MCP client

✅ **Quality Checks**:

1. Each prompt has clear system + user message
2. Prompts integrate with existing tools where applicable
3. User messages provide structured thinking frameworks
4. Arguments are optional and well-documented
5. No generic "fill in template" prompts - each guides a real workflow

## File Checklist

### To Create

- [ ] `src/prompts/prompts.ts` (single file, 5-7 prompts)

### To Update

- [ ] `src/server.ts` - Add prompt registration
- [ ] `README.md` - Add "Available Prompts" section
- [ ] `TODO.md` - Mark Phase 4.5 complete
- [ ] `AI-PROMPT.md` - Add prompt development patterns

### To Delete/Archive

- [ ] `PROMPTS_IMPLEMENTATION_PLAN.md` (original plan)
- [ ] `PROMPTS_PLAN_REVISED.md` (this file, after completion)

## Effort Breakdown

| Task | Time | Notes |
|------|------|-------|
| Create prompts.ts with 5 core prompts | 1 hour | Focus on quality, test as you go |
| Add 2 optional prompts if time permits | 30 min | Only if first 5 are solid |
| Integration into server.ts | 15 min | Simple import and registration |
| Build and manual testing | 30 min | Verify each prompt works |
| Documentation updates | 45 min | README, TODO, AI-PROMPT |
| **Total** | **2-3 hours** | Quality-focused, achievable |

## Next Actions

1. Update todo list with new simplified tasks
2. Create `src/prompts/prompts.ts` with first 5 prompts
3. Integrate and test
4. Document thoroughly
5. Commit with clear message

---

**Key Takeaway**: Better to have 5 excellent, useful prompts than 20 mediocre templates. Focus on workflows that genuinely help developers think through problems systematically.
