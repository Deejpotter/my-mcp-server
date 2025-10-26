# Contributing to My MCP Server

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Adding New Features](#adding-new-features)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

## Quick Start

```bash
# Clone and setup
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server

# Install dependencies
uv sync

# Test the server
uv run my-mcp-server --help

# Run interactive tool tester
uv run python scripts/test_tools.py
```

## Development Setup

### Prerequisites

- **Python 3.12+**
- **uv** package manager
- **Git**
- **VS Code** (recommended)

### Environment Configuration

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   Add your API keys:

   ```env
   # Required for specific features
   CLICKUP_API_KEY=your_key
   GITHUB_TOKEN=your_token
   BOOKSTACK_URL=your_url
   # ... see .env.example for full list
   ```

### IDE Setup

**VS Code Extensions (Recommended):**

- Python
- Pylance
- Ruff (linter)
- markdownlint

## Project Structure

```
my-mcp-server/
├── main.py                      # MCP server entry point
├── src/
│   ├── tool_registry.py         # Central tool routing
│   ├── resources.py             # MCP resources
│   ├── tools/                   # Tool implementations
│   │   ├── file_operations.py
│   │   ├── search_tools.py
│   │   └── system_commands.py
│   ├── integrations/            # API integrations
│   │   └── external_apis.py
│   └── utils/                   # Shared utilities
│       ├── security.py
│       ├── cache_rate_limit.py
│       └── performance.py
├── scripts/                     # Development scripts
│   ├── test_tools.py            # Interactive tool tester
│   └── generate_tool.py         # Tool template generator
├── tests/                       # Test suite
└── docs/                        # Documentation
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow the [Code Standards](#code-standards) section below.

### 3. Test Your Changes

```bash
# Interactive testing
uv run python scripts/test_tools.py

# Run all tests
uv run pytest tests/

# Test specific tool
uv run python scripts/test_tools.py --tool your_tool_name --args '{}'
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add your feature description"
```

**Commit Message Format:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `refactor:` - Code refactoring
- `chore:` - Build/tooling changes

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Adding New Features

### Adding a New Tool

Use the template generator for consistency:

```bash
uv run python scripts/generate_tool.py tool
```

This will:

1. Create the tool file with proper structure
2. Generate test template
3. Update tool_registry.py
4. Provide next steps

**Manual Process:**

1. **Choose appropriate module** in `src/tools/` or create new one
2. **Define tool schema** with JSON Schema validation
3. **Implement handler** with proper error handling
4. **Update tool_registry.py** to route the tool
5. **Add tests** in `tests/`
6. **Update documentation** in `docs/`

**Example Tool Structure:**

```python
def get_your_tools() -> List[Tool]:
    return [
        Tool(
            name="your_tool_name",
            description="Clear description of what it does",
            inputSchema={
                "type": "object",
                "properties": {
                    "param1": {
                        "type": "string",
                        "description": "Parameter description"
                    }
                },
                "required": ["param1"]
            }
        )
    ]

async def handle_your_tools(
    name: str, arguments: Dict[str, Any]
) -> List[types.TextContent]:
    if name == "your_tool_name":
        try:
            param1 = arguments.get("param1", "")
            # Your implementation here
            return [types.TextContent(
                type="text",
                text=f"✅ Success: {result}"
            )]
        except Exception as e:
            return [types.TextContent(
                type="text",
                text=f"❌ Error: {str(e)}"
            )]
```

### Adding an API Integration

Use the integration generator:

```bash
uv run python scripts/generate_tool.py integration
```

**Requirements:**

1. Add API credentials to `.env.example`
2. Implement async HTTP calls with `httpx`
3. Add rate limiting and caching if needed
4. Include helpful error messages
5. Handle missing API keys gracefully

## Code Standards

### Python Style

- **PEP 8** compliance
- **Type hints** for all functions (enforced by mypy)
- **Docstrings** for public APIs
- **Max line length**: 88 characters (Black default)

### Type Checking

All code must pass mypy type checking:

```bash
# Run type checker
./scripts/type_check.sh   # Linux/Mac
.\scripts\type_check.bat  # Windows

# Or directly with uv
uv run mypy src/ main.py
```

**Type Hint Requirements:**

- Use `Optional[T]` for nullable parameters, not `T = None`
- Add return type hints to all functions
- Use `Dict[str, Any]` instead of bare `dict`
- Import types from `typing`: `List`, `Dict`, `Optional`, `Any`

### Security Best Practices

**CRITICAL:**

- ✅ Use `safe_read_file()` / `safe_write_file()` for file operations
- ✅ Use `run_command()` for system commands (allowlist-based)
- ✅ Validate all file paths with `validate_file_path()`
- ✅ Never use `print()` - use `logger` (MCP servers must not write to stdout)
- ✅ Return `TextContent` for all tools - never raise exceptions to AI
- ✅ Validate user inputs before processing
- ✅ Set timeouts for all HTTP requests
- ✅ Use environment variables for API keys

**Example:**

```python
# ❌ BAD
def read_file(path):
    with open(path) as f:
        return f.read()

# ✅ GOOD
from src.utils.security import safe_read_file, validate_file_path

def read_file(path):
    validation = validate_file_path(path, "read")
    if not validation["valid"]:
        raise ValueError(f"Invalid path: {validation['checks']}")
    return safe_read_file(path, max_size=1024*1024)
```

### Error Handling

**MCP Protocol Requirement:**

All tools must return `TextContent`, never raise exceptions:

```python
# ✅ CORRECT
try:
    result = do_something()
    return [types.TextContent(type="text", text=f"Success: {result}")]
except Exception as e:
    return [types.TextContent(type="text", text=f"Error: {str(e)}")]
```

### Logging

**CRITICAL:** MCP servers communicate via JSON-RPC on stdout. **Never use `print()`!**

```python
# ❌ WRONG - Breaks MCP protocol
print("Debug info")

# ✅ CORRECT - Logs to stderr
import logging
logger = logging.getLogger(__name__)
logger.info("Debug info")
```

### Documentation

- **Add docstrings** to all public functions
- **Update README.md** for user-facing features
- **Update docs/COMPREHENSIVE_GUIDE.md** for detailed guides
- **Add inline comments** for complex logic
- **Include references** to relevant documentation

## Testing

### Running Tests

```bash
# All tests
uv run pytest tests/

# Specific test file
uv run pytest tests/test_security_hardening.py

# With coverage
uv run pytest --cov=src tests/

# Interactive tool testing
uv run python scripts/test_tools.py
```

### Writing Tests

```python
import pytest
from src.tools.your_module import get_your_tools, handle_your_tools

class TestYourTools:
    def test_get_tools(self):
        """Test that tools are properly defined"""
        tools = get_your_tools()
        assert len(tools) > 0
        assert all(hasattr(tool, "name") for tool in tools)
    
    @pytest.mark.asyncio
    async def test_your_tool(self):
        """Test your_tool functionality"""
        result = await handle_your_tools("your_tool", {"param": "value"})
        assert len(result) > 0
        assert "Success" in result[0].text
```

### Test Coverage Requirements

- **New features**: Must include tests
- **Bug fixes**: Add regression test
- **API integrations**: Mock external APIs
- **Security features**: Add security-specific tests

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass locally
- [ ] Type checking passes (mypy)
- [ ] Added tests for new features
- [ ] Updated relevant documentation
- [ ] No print() statements (use logger)
- [ ] Security best practices followed
- [ ] Commit messages are clear

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
How the changes were tested

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes
```

### Review Process

1. **Automated checks** run (linting, tests)
2. **Code review** by maintainer
3. **Testing** of new features
4. **Documentation review**
5. **Merge** when approved

## Development Tools

### Interactive Tool Tester

Test tools without VS Code:

```bash
uv run python scripts/test_tools.py

# Commands:
# list              - Show all tools
# show <tool>       - Show tool details
# call <tool> {...} - Call a tool
# test <tool>       - Interactive test mode
# perf              - Show performance metrics
```

### Tool Generator

Generate boilerplate for new tools:

```bash
# Generate a tool
uv run python scripts/generate_tool.py tool

# Generate an API integration
uv run python scripts/generate_tool.py integration
```

### Performance Monitoring

Check tool performance:

```bash
uv run python scripts/test_tools.py --tool performance_metrics
```

## Getting Help

- **Documentation**: Check `docs/` directory
- **Issues**: [GitHub Issues](https://github.com/Deejpotter/my-mcp-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Deejpotter/my-mcp-server/discussions)

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing!** 🎉

Your efforts help make this project better for everyone.
