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
			language: z.string().optional().describe("Programming language of the code (e.g., 'TypeScript', 'Python')"),
			focus_areas: z.string().optional().describe("Specific areas to focus on (e.g., 'security', 'performance', 'testing')"),
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
			library_name: z.string().optional().describe("Name of the library or framework to research"),
			use_case: z.string().optional().describe("Specific use case or requirement for the library"),
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
			error_description: z.string().optional().describe("Description of the bug or error"),
			context: z.string().optional().describe("Context about when/where the bug occurs"),
		},
		async (args) => {
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
			feature_description: z.string().optional().describe("Description of the feature to implement"),
			constraints: z.string().optional().describe("Any constraints or specific requirements"),
		},
		async (args) => {
			const featureDescription = args?.feature_description || "[describe the feature to implement]";
			const constraints = args?.constraints || "[any constraints or requirements]";

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
}
