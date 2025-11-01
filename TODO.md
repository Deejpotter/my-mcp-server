# TODO & Planned Changes

## Current Priorities

### Testing & Validation (in progress)

- [ ] Test all core tools in VS Code
  - File operations (read_file, write_file, list_files)
  - System monitoring (system_stats)
  - Command execution (run_command, security_status)
  - Git operations (git_command)
  
- [ ] Verify all resources working
  - system://info
  - workspace://info
  - git://status
  
- [ ] Security validation
  - Path traversal prevention
  - Command allowlist enforcement
  - File size limits
  - Timeout protection

### Documentation

- [ ] Add usage examples to README
- [ ] Create tool usage guide with real-world examples
- [ ] Document security best practices
- [ ] Add troubleshooting guide for common issues

## Near Term (Next Few Weeks)

### Testing & Quality

- [ ] Add Vitest unit tests for all tools
  - File operations test suite
  - Security validation tests
  - Command execution tests
  - Git tool tests
  
- [ ] Integration tests for MCP protocol
- [ ] Performance benchmarks
- [ ] Code coverage reporting

### Enhancement Ideas

- [ ] Add performance metrics tool
  - Track tool execution times
  - Show success/failure rates
  - Display min/max/avg execution times
  
- [ ] Add batch file operations
  - Validate multiple files at once
  - Report syntax errors and security issues
  
- [ ] Add project analyzer tool
  - Combine system, workspace, and git info
  - Provide project health summary

## Future Ideas (Someday/Maybe)

### New Tool Categories

- [ ] Web search tools
  - DuckDuckGo integration
  - Google Search (with SerpAPI)
  - News search
  
- [ ] Documentation search
  - Multi-source lookup (MDN, Stack Overflow, GitHub)
  - Intelligent caching
  
- [ ] API Integrations
  - GitHub code search and repos
  - ClickUp task management
  - Context7 documentation
  - BookStack knowledge base

### Advanced Features

- [ ] Plugin system for third-party tools
- [ ] Configuration UI for non-technical users
- [ ] Workspace templates
- [ ] Custom security policies per workspace

### Developer Experience

- [ ] Hot module reloading for faster development
- [ ] Built-in testing framework for tools
- [ ] Performance profiling utilities
- [ ] Auto-completion definitions for VS Code

## Known Issues

- [ ] Large file operations may timeout (>1MB default limit)
- [ ] Some Windows path edge cases may need handling
- [ ] Error messages could be more user-friendly in some cases

## Ideas from Users

> Add user suggestions and feature requests here

---

**Last Updated:** November 2, 2025  
**Status:** Core tools complete, testing in progress  
**Next Priority:** Complete validation and testing phase
