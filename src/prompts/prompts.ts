/**
 * Updated: 02/11/25
 * By: Daniel Potter
 *
 * MCP Prompts for workflow guidance.
 * Each prompt provides structured thinking and tool orchestration for common development workflows.
 * Focus on quality over quantity - each prompt guides a real development process.
 *
 * References:
 * MCP Prompts Spec: https://modelcontextprotocol.io/docs/concepts/prompts
 * Next.js DevTools MCP: https://github.com/vercel/next-devtools-mcp (workflow-focused prompts)
 * Claude Prompts MCP: https://github.com/minipuft/claude-prompts-mcp (rich templates)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register all workflow prompts with the MCP server
 *
 * Each prompt includes:
 * - System message: Sets expert context for Claude
 * - User message template: Provides structured workflow guidance
 * - Optional arguments: For customization without complexity
 */
export function registerPrompts(server: McpServer) {
	// PROMPT 1: CODE REVIEW GUIDE
	server.prompt(
		"code_review_guide",
		"Systematic code review workflow with quality, security, and performance checks",
		{
			language: z
				.string()
				.optional()
				.describe(
					"Programming language of the code (e.g., 'TypeScript', 'Python')"
				),
			focus_areas: z
				.string()
				.optional()
				.describe(
					"Specific areas to focus on (e.g., 'security', 'performance', 'testing')"
				),
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async (args) => {
			const language = args?.language || "the code";
			const focusAreas = args?.focus_areas || "all aspects";

			return {
				messages: [
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `You are an expert code reviewer who provides thorough, constructive feedback. You help developers improve code quality, security, and maintainability while teaching best practices.`,
						},
					},
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `# Code Review Workflow

## Context
Language: ${language}
Focus Areas: ${focusAreas}

## Step 1: Initial Assessment
First, understand what you're reviewing:
- **Purpose**: What does this code aim to accomplish?
- **Scope**: How many files? How complex?
- **Recent Changes**: What was added/modified (use \`git_command\` if needed)

## Step 2: Code Quality Review
- **Readability**: Is the code easy to understand?
- **Structure**: Is the code well-organized with clear separation of concerns?
- **Comments**: Are complex sections explained? Are comments up-to-date?
- **Error Handling**: Are errors handled appropriately?
- **DRY Principle**: Is there unnecessary code duplication?

## Step 3: Security Review
- **Input Validation**: Is user input properly validated and sanitized?
- **Authentication/Authorization**: Are security checks in place?
- **Data Exposure**: Is sensitive data protected?
- **Dependencies**: Are third-party packages secure and up-to-date?
- **Common Vulnerabilities**: Check for SQL injection, XSS, CSRF, etc.

## Step 4: Performance Review
- **Algorithms**: Are efficient algorithms used?
- **Database Queries**: Are queries optimized (N+1 problems)?
- **Caching**: Could caching improve performance?
- **Resource Management**: Are resources (connections, files) properly managed?
- **Memory Leaks**: Are there potential memory leaks?

## Step 5: Testing & Maintainability
- **Test Coverage**: Are critical paths tested?
- **Edge Cases**: Are edge cases handled?
- **Technical Debt**: Are there quick wins to reduce debt?
- **Documentation**: Is the code self-documenting or properly documented?

## Step 6: Specific Recommendations
Provide 3-5 specific, actionable improvements with:
1. **Location**: Where in the code (file, line number if available)
2. **Issue**: What needs improvement
3. **Suggestion**: How to improve it (with code example if helpful)
4. **Priority**: High/Medium/Low
5. **Rationale**: Why this improvement matters

## Available Tools
Use these MCP tools to examine code:
- \`read_file\`: Read specific files for detailed review
- \`list_files\`: Understand project structure
- \`run_command\`: Run linters, tests, or analysis tools
- \`git_command\`: Check git history, blame, or diff

Start by asking what code needs review, or use the tools to explore the codebase.`,
						},
					},
				],
			};
		}
	);

	// PROMPT 2: COMMIT MESSAGE COMPOSER
	server.prompt(
		"commit_message_composer",
		"Guide for creating meaningful commit messages following Conventional Commits specification",
		// eslint-disable-next-line @typescript-eslint/require-await
		async () => {
			return {
				messages: [
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `You are a git commit message expert who follows Conventional Commits specification and best practices for clear, meaningful commit messages that help teams understand project history.`,
						},
					},
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `# Commit Message Composition Workflow

## Step 1: Analyze Changes
Use the \`git_command\` tool to examine what has changed:
- Run: \`git status\` to see modified files
- Run: \`git diff\` to see specific changes
- Identify the scope and nature of changes

## Step 2: Determine Commit Type
Choose the appropriate type based on changes:
- **feat**: New feature or functionality
- **fix**: Bug fix
- **docs**: Documentation changes only
- **style**: Formatting, missing semicolons, etc. (no code change)
- **refactor**: Code refactoring (no functional changes)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process, dependencies, tooling

## Step 3: Identify Scope (Optional but Recommended)
What part of the codebase is affected?
- Component name (e.g., "auth", "api", "ui")
- Module name (e.g., "parser", "validator")
- Feature area (e.g., "search", "checkout")

## Step 4: Write Concise Summary (≤50 chars)
- Use imperative mood: "add" not "added" or "adds"
- Don't capitalize first letter
- No period at the end
- Be specific but concise

## Step 5: Add Body (If Needed)
Include if changes are non-trivial:
- Explain WHAT and WHY, not HOW
- Wrap at 72 characters
- Separate from summary with blank line
- Use bullet points for multiple points

## Step 6: Add Footer (If Applicable)
- Breaking changes: \`BREAKING CHANGE: description\`
- Issue references: \`Closes #123\`, \`Fixes #456\`
- Co-authors: \`Co-authored-by: Name <email>\`

## Format:
\`\`\`
<type>(<scope>): <summary>

<body>

<footer>
\`\`\`

## Examples:
\`\`\`
feat(auth): add two-factor authentication

Implements TOTP-based 2FA for user accounts.
- Add QR code generation for setup
- Create verification endpoint
- Update login flow to check 2FA status

Closes #234
\`\`\`

\`\`\`
fix(api): handle null response in user endpoint

Previously crashed when user not found.
Now returns 404 with appropriate message.
\`\`\`

\`\`\`
docs(readme): update installation instructions
\`\`\`

Start by running \`git_command\` with \`git status\` and \`git diff\` to analyze changes, then compose an appropriate commit message.`,
						},
					},
				],
			};
		}
	);

	// PROMPT 3: LIBRARY RESEARCH WORKFLOW
	server.prompt(
		"library_research_workflow",
		"Systematic approach to researching and evaluating libraries, frameworks, and tools",
		{
			library_name: z
				.string()
				.optional()
				.describe("Name of the library or framework to research"),
			use_case: z
				.string()
				.optional()
				.describe("Specific use case or requirement for the library"),
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async (args) => {
			const libraryName = args?.library_name || "[library name]";
			const useCase = args?.use_case || "[your use case]";

			return {
				messages: [
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `You are a technical researcher who helps developers systematically evaluate libraries, frameworks, and tools. You guide thorough research that considers functionality, reliability, community support, and fit for specific use cases.`,
						},
					},
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `# Library Research Workflow: ${libraryName}
Use Case: ${useCase}

## Step 1: Define Requirements
First, clarify what you need:
- **Core Functionality**: What must the library do?
- **Scale**: Expected load, data volume, performance needs
- **Constraints**: Language, platform, licensing, budget
- **Integration**: What does it need to work with?
- **Team**: Skill level, learning curve tolerance

## Step 2: Initial Discovery
Use search tools to find candidates:
- \`google_search\`: Search for "${libraryName} ${useCase}"
- \`google_search\`: Search for "best ${libraryName} alternatives"
- \`duckduckgo_search\`: Cross-reference with privacy-focused results

Look for:
- Official documentation sites
- GitHub repositories
- Comparison articles
- Community discussions

## Step 3: Get Official Documentation
Use Context7 tools for authoritative documentation:
- \`resolve_library_id\`: Find the library's Context7 ID
- \`get_documentation\`: Fetch comprehensive docs with topic focus

Questions to answer:
- Does it support your core requirements?
- Is the API well-designed and intuitive?
- Are there good code examples?
- What's the learning curve?

## Step 4: Evaluate Code Quality & Maintenance
Check the repository (if available):
- **Activity**: Recent commits, release frequency
- **Issues**: Response time, open vs closed ratio
- **Tests**: Test coverage, CI/CD setup
- **Documentation**: README quality, API docs, guides
- **Community**: Stars, forks, contributors

## Step 5: Assess Community & Support
- **Ecosystem**: Plugins, extensions, integrations
- **Resources**: Tutorials, courses, books
- **Community**: Stack Overflow questions, Discord/Slack
- **Backing**: Company support, sponsorship, governance

## Step 6: Evaluate Alternatives
Don't commit to the first option:
- Research 2-3 alternatives
- Create comparison matrix (features, pros, cons)
- Consider newer vs established options
- Read "X vs Y" comparison articles

## Step 7: Practical Evaluation
If possible, do a quick proof-of-concept:
- Install and test basic functionality
- Implement a simple use case
- Assess developer experience
- Identify potential issues early

## Step 8: Make Recommendation
Synthesize your findings:
- **Recommendation**: Which library and why
- **Strengths**: Key advantages for your use case
- **Weaknesses**: Limitations or concerns
- **Alternatives**: What else was considered
- **Next Steps**: How to proceed with implementation

## Available Tools
- \`resolve_library_id\`: Find Context7 library IDs
- \`get_documentation\`: Fetch official documentation
- \`google_search\`: Web search for articles, tutorials
- \`duckduckgo_search\`: Privacy-focused search
- \`read_file\`: Examine local files if testing locally

Start by clarifying requirements, then systematically work through discovery and evaluation.`,
						},
					},
				],
			};
		}
	);

	// PROMPT 4: BUG INVESTIGATION GUIDE
	server.prompt(
		"bug_investigation_guide",
		"Structured debugging methodology for systematic bug investigation and resolution",
		{
			error_description: z
				.string()
				.optional()
				.describe("Description of the bug or error"),
			context: z
				.string()
				.optional()
				.describe("Context about when/where the bug occurs"),
		},
		(args) => {
			const errorDescription = args?.error_description || "[describe the bug]";
			const context = args?.context || "[provide context]";

			return {
				messages: [
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `You are a debugging expert who applies systematic problem-solving techniques to investigate and resolve software bugs. You help developers methodically isolate issues and develop effective solutions.`,
						},
					},
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `# Bug Investigation Workflow

## Problem Statement
Error: ${errorDescription}
Context: ${context}

## Step 1: Reproduce the Bug
First, ensure you can consistently reproduce it:
- **Steps to Reproduce**: Document exact steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Frequency**: Always, intermittent, or under specific conditions?
- **Environment**: OS, browser, versions, configuration

## Step 2: Gather Information
Collect diagnostic data:
- **Error Messages**: Full stack traces, error codes
- **Logs**: Application logs, server logs, browser console
- **State**: What data/state led to the error?
- **Recent Changes**: What changed before bug appeared?

Use available tools:
- \`read_file\`: Examine relevant source files
- \`run_command\`: Run diagnostic commands, check logs
- \`list_files\`: Understand code structure
- \`git_command\`: Check git history with \`git log\`, \`git blame\`

## Step 3: Form Hypotheses
Based on information gathered, what could cause this?
- **Most Likely**: What's the probable cause?
- **Edge Cases**: Could it be something unusual?
- **Dependencies**: Could it be a library/external issue?

## Step 4: Test Hypotheses
Systematically test each hypothesis:
- **Isolation**: Can you isolate the problem to a specific component?
- **Simplification**: Reduce to minimal reproduction
- **Binary Search**: Comment out code sections to narrow down
- **Logging**: Add strategic console.error() or logging
- **Debugging**: Use debugger, breakpoints

## Step 5: Identify Root Cause
Verify you found the actual problem, not just a symptom:
- Does your fix address all reproduction cases?
- Could there be multiple issues?
- Is this the root cause or a symptom?

## Step 6: Develop Solution
Design a proper fix:
- **Quick Fix**: Immediate workaround (if needed)
- **Proper Fix**: Long-term solution
- **Tests**: How to prevent regression?
- **Impact**: What else might this affect?

Consider:
- Can you fix it without breaking other features?
- Should you refactor while fixing?
- Do you need to update tests?
- Should documentation be updated?

## Step 7: Verify & Test
Before considering it fixed:
- **Original Issue**: Does it fix the reported bug?
- **Regression**: Did you break anything else?
- **Edge Cases**: Test boundary conditions
- **All Environments**: Test where it matters (dev, staging, prod)

## Step 8: Document & Prevent
Help prevent similar issues:
- **Root Cause Analysis**: Document what happened and why
- **Tests**: Add automated tests to prevent regression
- **Code Review**: Have the fix reviewed
- **Knowledge Sharing**: Share lessons learned

## Common Debugging Techniques
- **Rubber Duck Debugging**: Explain problem out loud
- **Binary Search**: Divide and conquer approach
- **Check Assumptions**: Verify what you think is true
- **Fresh Eyes**: Take a break, or ask someone else
- **Logging**: Strategic console.error() placement
- **Version Control**: Use \`git bisect\` to find when bug appeared

Start by gathering information about the bug using available tools, then work through systematic hypothesis testing.`,
						},
					},
				],
			};
		}
	);

	// PROMPT 5: FEATURE IMPLEMENTATION PLAN
	server.prompt(
		"feature_implementation_plan",
		"Break down feature requirements into a structured implementation plan with steps and checklists",
		{
			feature_description: z
				.string()
				.optional()
				.describe("Description of the feature to implement"),
			constraints: z
				.string()
				.optional()
				.describe("Any constraints or specific requirements"),
		},
		(args) => {
			const featureDescription =
				args?.feature_description || "[describe the feature to implement]";
			const constraints =
				args?.constraints || "[any constraints or requirements]";

			return {
				messages: [
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `You are a software architect who helps plan feature implementations systematically. You break down complex features into manageable steps, identify dependencies, and create clear implementation plans.`,
						},
					},
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `# Feature Implementation Plan

## Feature Description
${featureDescription}

## Constraints/Requirements
${constraints}

## Step 1: Understand Requirements
Clarify what needs to be built:
- **User Story**: Who needs this and why?
- **Acceptance Criteria**: How do we know it's done?
- **Scope**: What's included and what's not?
- **Dependencies**: What does this depend on?
- **Constraints**: Technical, timeline, resource limits

## Step 2: Architecture Design
Plan the technical approach:
- **High-Level Design**: How will this work?
- **Components**: What pieces are needed?
- **Data Model**: What data structures/schemas?
- **APIs**: What endpoints or interfaces?
- **Integration Points**: Where does this connect?

Use tools to understand existing code:
- \`list_files\`: Explore project structure
- \`read_file\`: Examine relevant existing code
- \`run_command\`: Check current setup, dependencies

## Step 3: File Changes Needed
Identify what files need changes:

**New Files to Create**:
- List new files with purpose of each

**Existing Files to Modify**:
- List files that need updates
- Note what changes in each

**Files to Delete** (if any):
- List files to remove

## Step 4: Implementation Steps
Break down into sequential tasks:

1. **Setup & Dependencies**
   - Install any new packages
   - Update configuration
   - Set up any infrastructure

2. **Data Layer** (if applicable)
   - Database migrations
   - Models/schemas
   - Data access layer

3. **Core Logic**
   - Implement main functionality
   - Handle edge cases
   - Add error handling

4. **Integration**
   - Wire up components
   - Connect to existing systems
   - Handle side effects

5. **User Interface** (if applicable)
   - UI components
   - Forms and validation
   - User feedback

6. **Testing**
   - Unit tests for core logic
   - Integration tests
   - E2E tests if needed

7. **Documentation**
   - Update README if needed
   - API documentation
   - User guide updates

## Step 5: Testing Strategy
Plan how to verify it works:
- **Unit Tests**: Test individual functions/components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Edge Cases**: Boundary conditions, error cases
- **Performance**: Load testing if needed

## Step 6: Rollout Plan
How to deploy safely:
- **Feature Flags**: Can we enable incrementally?
- **Migration**: Any data migration needed?
- **Rollback Plan**: How to undo if problems?
- **Monitoring**: What metrics to watch?
- **Communication**: Who needs to know?

## Step 7: Success Metrics
How to measure success:
- **Functionality**: Does it work as intended?
- **Performance**: Meets performance targets?
- **User Adoption**: Are users using it?
- **Error Rates**: Any new errors introduced?
- **Business Impact**: Does it achieve business goal?

## Risk Assessment
Identify potential issues:
- **Technical Risks**: Complexity, unknowns
- **Timeline Risks**: Dependencies, blockers
- **Integration Risks**: Breaking changes, compatibility
- **Mitigation Strategies**: How to address each risk

Start by exploring the codebase to understand the current implementation, then work through the planning steps systematically.`,
						},
					},
				],
			};
		}
	);

	// PROMPT 6: SEARCH OPTIMIZER
	server.prompt(
		"search_strategy_guide",
		"Transforms user's rough search intent into optimized queries for Google, DuckDuckGo, and Context7 tools",
		{
			user_query: z
				.string()
				.describe("The user's original search query or intent"),
			context: z
				.string()
				.optional()
				.describe("Additional context about what they're working on"),
		},
		(args) => {
			const userQuery = args?.user_query || "[user's search query]";
			const context = args?.context || "";

			return {
				messages: [
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `You are a search optimization expert. Your job is to take a user's rough search query and transform it into highly effective searches across multiple tools. You understand:

- How to extract intent from vague queries
- Which search tool is best for different information needs
- How to formulate queries that get precise results
- What search operators and filters to use
- How to structure multi-step search strategies

You provide actionable search plans with specific queries ready to execute.`,
						},
					},
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `# Optimize This Search

## User's Original Query
"${userQuery}"

${context ? `## Additional Context\n${context}\n` : ""}
${context ? `## Additional Context\n${context}\n` : ""}
## Your Task
Analyze the user's query and create an optimized search strategy. Provide:

1. **Intent Analysis**: What is the user really trying to find?
2. **Recommended Tool**: Which tool(s) to use first and why
3. **Optimized Queries**: Specific, ready-to-execute search queries
4. **Search Strategy**: Step-by-step approach if multiple searches needed

---

## Step 1: Understand the Intent

Classify the search type:
- 📚 **Official Documentation** → Use Context7 (resolve_library_id + get_documentation)
- 🐛 **Error/Bug** → Use Google with exact error message in quotes
- 📖 **Tutorial/Learning** → Use Google or DuckDuckGo for community content
- 💻 **Code Examples** → Context7 first, then Google "site:github.com"
- 🔍 **Comparison** → DuckDuckGo for unbiased results, then Context7 for official docs
- 📰 **Latest News** → Google with recent date filter

## Step 2: Extract Key Information

From the user's query, identify:
- **Technology/Library**: What specific tool or framework?
- **Version**: Is a specific version mentioned or implied?
- **Problem**: Error message, concept, or feature?
- **Context**: Language, framework, environment?

## Step 3: Choose the Best Tool

### Use Context7 (\`resolve_library_id\` + \`get_documentation\`) when:
✅ Looking for official API documentation
✅ Need authoritative, version-specific information
✅ Want code examples from official sources
✅ Learning framework basics or getting started

**Example queries for Context7:**
- For library docs: "Next.js", "React", "TypeScript"
- With topic: library="Next.js", topic="routing"
- With version: library="React 18", topic="hooks"

### Use Google Search (\`google_search\`) when:
✅ Searching for error messages
✅ Need Stack Overflow solutions
✅ Want blog tutorials or guides
✅ Looking for community discussions
✅ Recent news or updates

**Example queries for Google:**
- Error: \`"Error: ENOENT: no such file or directory" node.js\`
- How-to: \`how to deploy Next.js to vercel 2025\`
- GitHub: \`site:github.com react custom hooks examples\`
- Stack Overflow: \`site:stackoverflow.com typescript generics\`
- Version specific: \`Node.js 20 new features\`

### Use DuckDuckGo (\`duckduckgo_search\`) when:
✅ Want unbiased, non-personalized results
✅ Privacy is important
✅ Quick factual lookups
✅ Comparing options without SEO bias
✅ Alternative to Google for general queries

**Example queries for DuckDuckGo:**
- Comparison: \`React vs Vue 2025 comparison\`
- Definition: \`what is serverless computing\`
- Unbiased review: \`best typescript ORM\`

## Step 4: Formulate Optimized Queries

### Query Optimization Techniques:

**Be Specific:**
❌ Bad: "react error"
✅ Good: "react useEffect cleanup function not called"

**Add Context:**
❌ Bad: "authentication"
✅ Good: "Next.js 14 API route JWT authentication TypeScript"

**Use Exact Matches for Errors:**
❌ Bad: database connection error
✅ Good: "Error: connect ECONNREFUSED 127.0.0.1:5432" postgresql

**Include Version Numbers:**
❌ Bad: "node fetch"
✅ Good: "Node.js 18 native fetch API"

**Google Search Operators:**
- \`"exact phrase"\` - Exact match
- \`site:domain.com\` - Search specific site
- \`-exclude\` - Remove term
- \`OR\` - Either term
- \`filetype:pdf\` - Specific file type
- \`after:2024\` - Recent results

## Step 5: Provide the Optimized Search Plan

Format your response as:

### 🎯 Intent
[What the user is trying to accomplish]

### 🛠️ Recommended Tool
**Primary**: [Tool name] - [Why this tool]
**Fallback**: [Alternative tool] - [When to use]

### 📝 Optimized Queries

**Query 1 (Context7/Google/DuckDuckGo):**
\`\`\`
[Exact query to execute]
\`\`\`
**Why**: [Brief explanation]

**Query 2 (if needed):**
\`\`\`
[Exact query to execute]
\`\`\`
**Why**: [Brief explanation]

### 📋 Search Strategy
1. [First step with tool]
2. [If that doesn't work, try this]
3. [How to evaluate results]

---

**Available Tools:**
- \`resolve_library_id\` + \`get_documentation\` - Context7 official docs
- \`google_search\` - Web search via SerpAPI
- \`duckduckgo_search\` - Privacy-focused web search

Now analyze the user's query and provide the optimized search plan!`,
						},
					},
				],
			};
		}
	);

	// PROMPT 7: BOOKSTACK IMAGE GENERATOR
	server.prompt(
		"bookstack_image_generator",
		"Generate AI images for BookStack shelves, books, and documentation with professional styling",
		{
			content_type: z
				.string()
				.optional()
				.describe(
					"Type of content: 'shelf', 'book', 'chapter', 'technical', 'tutorial'"
				),
			topic: z
				.string()
				.optional()
				.describe(
					"Main topic or subject matter (e.g., 'MCP Server', 'CNC Routing')"
				),
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async (args) => {
			const contentType = args?.content_type || "book";
			const topic = args?.topic || "the documentation";

			return {
				messages: [
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `You are an expert at creating professional, visually appealing images for documentation using AI image generation. You specialize in creating clean, minimalist cover images for BookStack shelves, books, and technical documentation.`,
						},
					},
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `# BookStack Image Generation Workflow

## Context
Content Type: ${contentType}
Topic: ${topic}

## Step 1: Understand the Content
Before generating images:
- **Purpose**: What is this documentation about?
- **Audience**: Who will use this? (technical, general, professional)
- **Existing Images**: Check BookStack for current visual style
- **Brand Identity**: Does this match the documentation's theme?

## Step 2: Choose Image Style

### For Shelves (Collection Images)
- **Style**: Abstract, geometric, or iconographic
- **Elements**: Minimal (3-5 elements max)
- **Focus**: Visual metaphor for the collection theme
- **Examples**:
  - "Projects" → Blueprint, code editor, tools
  - "Development" → Terminal window, git branches, modern workspace
  - "Infrastructure" → Server racks, network diagram, cloud

### For Books (Cover Images)
- **Style**: Professional tech book cover
- **Elements**: Central icon/symbol + clean background
- **Focus**: Single clear concept
- **Examples**:
  - "MCP Server" → Plug/connection symbol, API diagram
  - "CNC Routing" → CNC machine silhouette, precision tools
  - "React Guide" → React logo, component tree

### For Technical Documentation
- **Style**: Diagram-style, blueprint aesthetic
- **Elements**: Technical but approachable
- **Focus**: Core concept visualization
- **Examples**:
  - Architecture → Clean system diagram
  - API docs → Endpoint flow diagram
  - Tutorial → Step-by-step visual

## Step 3: Craft the Perfect Prompt

### Prompt Formula
\`\`\`
[Main subject], [style], [color scheme], [composition], [technical details]
\`\`\`

### Best Practices
- **Be specific**: "Modern server icon" not just "server"
- **Include style**: "flat design", "isometric", "minimalist", "blueprint style"
- **Set mood**: "professional", "clean", "technical", "modern"
- **Specify background**: "white background", "gradient blue to purple", "dark theme"
- **Add constraints**: "simple", "no text", "centered", "high contrast"

### Example Prompts

**Shelf Image (Projects):**
\`\`\`
Minimalist illustration of a laptop with code editor and project files, 
flat design style, gradient blue to teal background, isometric view, 
professional tech aesthetic, clean composition, no text
\`\`\`

**Book Cover (MCP Server):**
\`\`\`
Abstract geometric representation of connected nodes and APIs, modern 
technical diagram style, dark blue background with bright accent lines, 
centered composition, professional software documentation aesthetic, 
circuit board elements, no text
\`\`\`

**Technical Diagram (Architecture):**
\`\`\`
Clean system architecture diagram showing modular components, blueprint 
style with white lines on navy blue background, technical but minimalist, 
professional engineering aesthetic, geometric shapes, no labels
\`\`\`

## Step 4: Generate with Negative Prompts

### What to Avoid
Use negative prompts to prevent:
- "text, words, labels, typography, numbers"
- "cluttered, busy, complex, detailed textures"
- "photorealistic, blurry, low quality, distorted"
- "people, faces, hands" (unless specifically needed)

### Recommended Settings
- **Model**: flux-schnell (fast, high quality)
- **Size**: 1024x768 or 768x1024 (landscape/portrait)
- **Guidance Scale**: 7-8 (balanced adherence)
- **Quality**: High (80-90)

## Step 5: Use the Image Generation Tool

\`\`\`typescript
image_generate({
  prompt: "[Your crafted prompt]",
  output_path: "/home/user/bookstack-images/[descriptive-name].png",
  size: "1024x768", // or "768x1024" for vertical
  model: "flux-schnell",
  negative_prompt: "text, words, labels, cluttered, blurry, low quality",
  guidance_scale: 7.5
})
\`\`\`

## Step 6: Review and Iterate

After generation:
- **Check Quality**: Is it professional and clean?
- **Check Relevance**: Does it represent the content well?
- **Check Style**: Does it match existing BookStack images?
- **Iterate if Needed**: Refine prompt and regenerate

## Step 7: Optimize and Update BookStack

### Optimize the Image
\`\`\`typescript
// Convert to WebP for better compression
image_convert({
  input: "/path/to/image.png",
  output_format: "webp",
  quality: 85
})

// Or optimize in place
image_optimize({
  input: "/path/to/image.png",
  quality: 85,
  preserve_metadata: false
})
\`\`\`

### Update BookStack
\`\`\`typescript
// For a shelf
bookstack_update_shelf({
  shelf_id: 1,
  // Upload image via BookStack UI, then reference in description
})

// For a book
bookstack_update_book({
  book_id: 6,
  // Upload image via BookStack UI as cover
})
\`\`\`

## Common Use Cases

### Shelf Icons (Collection Thumbnails)
- **Size**: 768x768 (square works best)
- **Style**: Simple icon-based
- **Prompt**: "Single [icon] representing [theme], flat design, white background"

### Book Covers (Documentation)
- **Size**: 768x1024 (portrait)
- **Style**: Professional book cover
- **Prompt**: "[Subject] book cover, modern tech design, [color scheme]"

### Feature Banners (Page Headers)
- **Size**: 1024x768 (landscape)
- **Style**: Wide banner, conceptual
- **Prompt**: "Wide banner showing [concept], minimalist, professional"

## Tips for Success

1. **Keep it simple**: Fewer elements = cleaner result
2. **Be consistent**: Match existing image styles
3. **No text in AI**: Add text in post-processing if needed
4. **Test iterations**: Generate 2-3 variations, pick best
5. **Optimize size**: Always compress before upload
6. **Professional over pretty**: Technical accuracy > artistic flair

## Available Tools
- \`image_generate\`: Create images from text prompts
- \`image_convert\`: Change format (PNG → WebP)
- \`image_resize\`: Adjust dimensions if needed
- \`image_optimize\`: Compress for web performance
- \`bookstack_update_*\`: Update shelf/book with new images

Start by understanding what image you need, then craft a specific, professional prompt!`,
						},
					},
				],
			};
		}
	);

	// PROMPT 8: DOCUMENTATION WRITER
	server.prompt(
		"documentation_writer",
		"Structured approach to writing clear, comprehensive technical documentation",
		{
			doc_type: z
				.string()
				.optional()
				.describe(
					"Type of documentation: 'api', 'guide', 'reference', 'tutorial', 'readme'"
				),
			audience: z
				.string()
				.optional()
				.describe(
					"Target audience: 'developers', 'end-users', 'internal-team', 'contributors'"
				),
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async (args) => {
			const docType = args?.doc_type || "technical documentation";
			const audience = args?.audience || "developers";

			return {
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: `# Technical Documentation Writer

You are a technical writing expert creating ${docType} for ${audience}.

## Documentation Principles

### 1. User-Focused Structure
- **Start with why**: What problem does this solve?
- **Clear hierarchy**: Logical flow from basic to advanced
- **Scannable**: Headers, lists, code blocks
- **Examples first**: Show before explaining
- **Progressive disclosure**: Essential info up front, details later

### 2. Writing Style
- **Active voice**: "Click the button" not "The button should be clicked"
- **Present tense**: "This function returns" not "This function will return"
- **Short sentences**: One idea per sentence
- **No jargon**: Or define it when necessary
- **Consistent terms**: Pick one name and stick with it

### 3. Structure Templates

#### API Documentation
\`\`\`markdown
# Function/Endpoint Name

## Overview
Brief 1-2 sentence description of what it does.

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | Yes | What it does |

## Returns
Description of return value and type.

## Example
\`\`\`code
// Working example
\`\`\`

## Error Handling
Common errors and how to handle them.

## Notes
Additional context, edge cases, best practices.
\`\`\`

#### Tutorial/Guide
\`\`\`markdown
# Tutorial Title

## What You'll Build
Clear description of the end result.

## Prerequisites
- List required knowledge
- Link to setup guides

## Step 1: [Action Verb]
Explanation of what and why.
\`\`\`code
// Code example
\`\`\`
What just happened and why it matters.

## Step 2: [Next Action]
...

## Conclusion
- What you learned
- Next steps
- Related resources
\`\`\`

#### README
\`\`\`markdown
# Project Name
One-line description.

## Features
- Key feature 1
- Key feature 2

## Quick Start
\`\`\`bash
# Minimum viable example
\`\`\`

## Installation
Detailed setup instructions.

## Usage
Common use cases with examples.

## API Reference
Link to detailed docs.

## Contributing
How to contribute.

## License
\`\`\`

### 4. Code Examples Best Practices

**Complete & Runnable**
\`\`\`typescript
// ✅ Good - complete example
import { server } from './server';

server.registerTool('example', schema, async (args) => {
  return { content: [{ type: 'text', text: 'result' }] };
});
\`\`\`

\`\`\`typescript
// ❌ Bad - incomplete
registerTool('example', ...);
\`\`\`

**Real-World Context**
\`\`\`typescript
// ✅ Good - shows realistic use
const userData = await fetchUser(userId);
if (!userData) {
  throw new Error(\`User \${userId} not found\`);
}
\`\`\`

\`\`\`typescript
// ❌ Bad - too abstract
const data = await fetch();
\`\`\`

**Include Error Handling**
\`\`\`typescript
// ✅ Good - handles errors
try {
  const result = await operation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);
  throw error;
}
\`\`\`

### 5. Visual Hierarchy

**Use Headers Effectively**
- # Main Title (one per document)
- ## Major Sections
- ### Subsections
- #### Details (use sparingly)

**Lists for Options**
- Bullet points for unordered items
- Numbered lists for sequential steps
- Definition lists for term explanations

**Tables for Comparisons**
| Feature | Option A | Option B |
|---------|----------|----------|
| Speed   | Fast     | Faster   |

**Code Blocks with Language**
\`\`\`typescript
// Always specify language for syntax highlighting
\`\`\`

### 6. Documentation Workflow

#### Phase 1: Research
1. **Understand the code**: Read implementation thoroughly
2. **Identify audience**: Who will read this?
3. **Gather requirements**: What questions will they have?
4. **Use Context7**: Check official library docs for accuracy

#### Phase 2: Outline
1. **List key topics**: What must be covered?
2. **Order logically**: Basic → Advanced or Problem → Solution
3. **Identify examples**: What will you demonstrate?
4. **Plan structure**: Which template fits best?

#### Phase 3: Write
1. **Start with examples**: Code first, explanation second
2. **Write in passes**: 
   - Pass 1: Get content down
   - Pass 2: Clarify and simplify
   - Pass 3: Polish and proofread
3. **Test code**: All examples must work
4. **Add cross-references**: Link related sections

#### Phase 4: Review
1. **Check completeness**: Can readers accomplish the goal?
2. **Verify accuracy**: Technical details correct?
3. **Test examples**: Copy-paste and run
4. **Read aloud**: Catches awkward phrasing
5. **Get feedback**: Have someone else review

#### Phase 5: Publish
1. **Update BookStack**: Create or update page
2. **Update README**: Add brief description
3. **Add to index**: Link from relevant pages
4. **Version control**: Commit with clear message

### 7. Common Pitfalls to Avoid

❌ **Assuming knowledge**: Define terms, don't assume readers know
❌ **Outdated examples**: Keep code examples current
❌ **Missing context**: Explain why, not just how
❌ **Wall of text**: Break up with headers, lists, examples
❌ **Passive voice**: "The button is clicked" → "Click the button"
❌ **Future tense**: "This will do" → "This does"
❌ **Inconsistent terminology**: Pick terms and stick with them
❌ **No error guidance**: Show how to handle failures
❌ **Complex examples**: Start simple, then show advanced

### 8. Tools & Resources

**For Writing**
- \`bookstack_search\`: Find existing documentation
- \`bookstack_get_page\`: Review current content
- \`bookstack_create_page\`: Create new documentation
- \`bookstack_update_page\`: Update existing docs

**For Code Examples**
- \`git_command\`: Check actual implementation
- \`run_command\`: Test code examples
- Context7 tools: Verify against official docs

**For Research**
- \`duckduckgo_search\`: Find best practices
- \`google_search\`: Research examples
- \`context7_get_documentation\`: Official API references

### 9. Quality Checklist

Before publishing, verify:
- [ ] Clear purpose stated upfront
- [ ] Target audience identified
- [ ] Logical structure and flow
- [ ] All code examples tested
- [ ] Error cases documented
- [ ] Prerequisites listed
- [ ] Related resources linked
- [ ] Consistent terminology
- [ ] No jargon (or defined)
- [ ] Scannable with headers/lists

### 10. Documentation Types Guide

**API Reference**: Comprehensive parameter/return documentation
**Tutorial**: Step-by-step learning experience
**Guide**: Task-focused how-to documentation
**README**: Project overview and quick start
**Troubleshooting**: Problem-solution pairs
**Architecture**: System design and decisions
**Contributing**: How to contribute to project

## Next Steps

1. Identify what needs documentation
2. Choose appropriate template/structure
3. Research thoroughly (use Context7 for official docs)
4. Write with examples first
5. Test all code samples
6. Review for clarity
7. Publish to BookStack
8. Update related documentation

Remember: Good documentation saves time, reduces support burden, and helps users succeed!`,
						},
					},
				],
			};
		}
	);

	// PROMPT 9: API INTEGRATION PLANNER
	server.prompt(
		"api_integration_planner",
		"Research and plan new API integrations with comprehensive evaluation workflow",
		{
			api_name: z
				.string()
				.optional()
				.describe(
					"Name of the API to integrate (e.g., 'GitHub API', 'Stripe')"
				),
			use_case: z
				.string()
				.optional()
				.describe("What you want to achieve with this API integration"),
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async (args) => {
			const apiName = args?.api_name || "the target API";
			const useCase = args?.use_case || "your requirements";

			return {
				messages: [
					{
						role: "assistant" as const,
						content: {
							type: "text" as const,
							text: `You are an expert at API integration planning. You help developers evaluate, design, and implement robust API integrations by conducting thorough research and creating comprehensive implementation plans.`,
						},
					},
					{
						role: "user" as const,
						content: {
							type: "text" as const,
							text: `# API Integration Planning Workflow

## Context
API: ${apiName}
Use Case: ${useCase}

## Phase 1: Research & Discovery

### 1.1 Documentation Review
**Use Context7 for official API documentation**
- API overview and capabilities
- Authentication methods (API key, OAuth, JWT, etc.)
- Rate limits and quotas
- Pricing/usage tiers
- API versioning strategy
- SDKs and client libraries available

### 1.2 Technical Requirements
- Required credentials/setup
- Network requirements (webhooks, IPs, ports)
- Data formats (JSON, XML, GraphQL)
- Required dependencies
- Environment configuration

### 1.3 Use Case Mapping
- Map your requirements to API endpoints
- Identify which API features you need
- Check if API supports your use case fully
- Note any limitations or workarounds needed

## Phase 2: Security & Compliance

### 2.1 Authentication Security
- How are credentials stored? (environment variables, secrets manager)
- Token refresh mechanisms
- Credential rotation requirements
- Multi-user authentication considerations

### 2.2 Data Security
- What data is transmitted?
- Is data encrypted in transit (HTTPS)?
- Data retention policies
- PII/sensitive data handling
- GDPR/compliance requirements

### 2.3 Access Control
- API scopes/permissions needed
- Principle of least privilege
- Service account vs user authentication
- Audit logging requirements

## Phase 3: Design & Architecture

### 3.1 Integration Pattern
Choose appropriate pattern:
- **Direct Integration**: Simple API calls from application
- **Backend Proxy**: Hide credentials, add caching
- **Event-Driven**: Webhooks for real-time updates
- **Background Jobs**: Async processing for bulk operations

### 3.2 Error Handling Strategy
- HTTP status code handling (4xx, 5xx)
- Retry logic with exponential backoff
- Circuit breaker pattern for availability
- Timeout configuration
- Error logging and monitoring

### 3.3 Rate Limiting & Performance
- Understand API rate limits
- Implement client-side rate limiting
- Request batching opportunities
- Caching strategy (what, where, TTL)
- Connection pooling for performance

## Phase 4: Implementation Planning

### 4.1 Code Organization
\`\`\`
src/
  integrations/
    [api-name]/
      client.ts          # API client wrapper
      types.ts           # TypeScript types
      auth.ts            # Authentication logic
      errors.ts          # Custom error classes
      __tests__/         # Integration tests
\`\`\`

### 4.2 Configuration Structure
\`\`\`typescript
// Environment variables
API_KEY=your_api_key
API_BASE_URL=https://api.example.com/v1
API_TIMEOUT=30000
API_RATE_LIMIT=100
\`\`\`

### 4.3 TypeScript Types
\`\`\`typescript
// Define request/response types
interface ApiRequest {
  // Based on API documentation
}

interface ApiResponse {
  // Based on API documentation
}

interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
\`\`\`

### 4.4 Client Implementation Template
\`\`\`typescript
import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  apiKey: z.string(),
  baseUrl: z.string().url(),
  timeout: z.number().default(30000),
  rateLimit: z.number().default(100),
});

// API client class
export class ApiClient {
  private config: z.infer<typeof configSchema>;
  private rateLimiter: RateLimiter;

  constructor(config: unknown) {
    this.config = configSchema.parse(config);
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
  }

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Rate limiting
    await this.rateLimiter.acquire();

    // Make request with error handling
    try {
      const response = await fetch(
        \`\${this.config.baseUrl}\${endpoint}\`,
        {
          ...options,
          headers: {
            'Authorization': \`Bearer \${this.config.apiKey}\`,
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          signal: AbortSignal.timeout(this.config.timeout),
        }
      );

      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }

      return response.json();
    } catch (error) {
      // Error handling logic
      throw this.handleError(error);
    }
  }

  private handleError(error: unknown): ApiError {
    // Convert errors to ApiError
  }
}
\`\`\`

## Phase 5: Testing Strategy

### 5.1 Unit Tests
- Mock API responses
- Test error handling
- Test rate limiting
- Test timeout behavior

### 5.2 Integration Tests
- Test against real API (sandbox/test environment)
- Test authentication flow
- Test common workflows
- Test error scenarios

### 5.3 Load Testing
- Test rate limit handling
- Test concurrent requests
- Monitor memory/CPU usage

## Phase 6: Monitoring & Maintenance

### 6.1 Logging
- Log all API requests (method, endpoint, status)
- Log errors with context
- Track rate limit usage
- Monitor response times

### 6.2 Metrics
- Request success/failure rate
- Response time distribution
- Rate limit utilization
- Error rate by type

### 6.3 Alerts
- High error rate
- Rate limit approaching
- Slow response times
- Authentication failures

## Phase 7: Documentation

### 7.1 Internal Documentation
Create in BookStack:
- API overview and capabilities
- Authentication setup guide
- Usage examples
- Error handling guide
- Rate limits and best practices
- Troubleshooting common issues

### 7.2 Code Documentation
- JSDoc for public methods
- README in integration directory
- Configuration options documented
- Example usage in comments

## Implementation Checklist

**Research Phase**:
- [ ] Read official API documentation (use Context7)
- [ ] Identify required endpoints
- [ ] Check rate limits and quotas
- [ ] Review authentication requirements
- [ ] Check for existing SDKs/libraries
- [ ] Review pricing/usage costs

**Security Phase**:
- [ ] Plan credential storage
- [ ] Design authentication flow
- [ ] Identify sensitive data handling
- [ ] Check compliance requirements
- [ ] Plan error message sanitization

**Design Phase**:
- [ ] Choose integration pattern
- [ ] Design error handling strategy
- [ ] Plan rate limiting approach
- [ ] Design caching strategy
- [ ] Create TypeScript types

**Implementation Phase**:
- [ ] Set up project structure
- [ ] Implement API client
- [ ] Add error handling
- [ ] Implement rate limiting
- [ ] Add logging
- [ ] Write unit tests
- [ ] Write integration tests

**Testing Phase**:
- [ ] Test authentication
- [ ] Test happy path scenarios
- [ ] Test error scenarios
- [ ] Test rate limiting
- [ ] Load testing (if applicable)

**Documentation Phase**:
- [ ] Create BookStack page
- [ ] Document configuration
- [ ] Add usage examples
- [ ] Create troubleshooting guide
- [ ] Update project README

**Deployment Phase**:
- [ ] Configure environment variables
- [ ] Set up monitoring
- [ ] Configure alerts
- [ ] Deploy to staging
- [ ] Test in staging
- [ ] Deploy to production

## Common Pitfalls to Avoid

**Authentication**:
- ❌ Hardcoding credentials
- ❌ Not implementing token refresh
- ❌ Exposing credentials in logs/errors

**Rate Limiting**:
- ❌ Not implementing client-side rate limiting
- ❌ Not handling 429 responses
- ❌ Not using exponential backoff

**Error Handling**:
- ❌ Not catching network errors
- ❌ Not handling timeouts
- ❌ Exposing sensitive error details to users

**Testing**:
- ❌ Only testing happy path
- ❌ Not testing against real API
- ❌ Not testing rate limit behavior

**Monitoring**:
- ❌ No logging of API calls
- ❌ No metrics/alerts
- ❌ Not tracking API costs

## Tools to Use

**Research & Documentation**:
- \`search_documentation\` - Find API documentation via Context7
- \`get_documentation\` - Get detailed API docs
- \`duckduckgo_search\` or \`google_search\` - Find examples and discussions

**Implementation**:
- \`read_file\` - Review existing code patterns
- \`write_file\` - Create new integration files
- \`run_command\` - Install dependencies

**Documentation**:
- \`bookstack_create_page\` - Document the integration
- \`bookstack_search\` - Find related documentation

## Example Workflow

1. **Start**: "I need to integrate the Stripe API for payment processing"
2. **Research**: Use Context7 to get Stripe API documentation
3. **Design**: Choose backend proxy pattern for credential security
4. **Plan**: Create implementation checklist
5. **Implement**: Build client with TypeScript types
6. **Test**: Write tests for payment flows
7. **Document**: Create BookStack guide
8. **Deploy**: Set up monitoring and alerts

## Next Steps

1. Gather API documentation using Context7
2. Map API capabilities to your use case
3. Design integration architecture
4. Create implementation plan
5. Build and test incrementally
6. Document thoroughly
7. Deploy with monitoring

Remember: Thorough planning prevents integration issues. Research first, implement carefully, test thoroughly!`,
						},
					},
				],
			};
		}
	);
}
