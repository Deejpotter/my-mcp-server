# MCP Server Security Guidelines

## Developer Documentation for Secure Development

**Updated:** 26/10/25  
**By:** Daniel Potter  
**Security Version:** 1.0.0

### Overview

This MCP server implementation includes comprehensive security hardening to protect against common web application vulnerabilities including:

- **Command Injection (CWE-78)**: Prevention through allowlist validation and shell metacharacter detection
- **Path Traversal (CWE-22)**: Protection via canonical path resolution and directory allowlists  
- **Credential Exposure**: Environment variable filtering to prevent accidental leakage
- **Resource Exhaustion**: File size limits and timeout controls
- **Server-Side Request Forgery (SSRF)**: URL validation for fetch operations

## Security Architecture

### Core Security Components

#### 1. Command Execution Security (`security.py`)

```python
# Allowlist-based command validation
ALLOWED_COMMANDS = {
    'git': ['status', 'log', 'diff', 'show', 'branch', 'remote', 'rev-parse'],
    'ls': [],
    'pwd': [],
    'echo': [],
    'cat': [],
    'grep': ['-n', '-i', '-r'],
    'find': ['-name', '-type', '-maxdepth'],
    'which': [],
    'whoami': []
}

# Safe command execution
result = run_command("git status")  # ✅ Allowed
result = run_command("rm -rf /")     # ❌ Blocked
```

#### 2. File Access Security

```python
# Safe file operations with path validation
content = safe_read_file("./config.json")        # ✅ Allowed  
content = safe_read_file("../../../etc/passwd")  # ❌ Blocked

# Directory allowlist
ALLOWED_DIRECTORIES = [
    os.getcwd(),           # Current working directory
    tempfile.gettempdir()  # System temp directory
]
```

#### 3. Environment Protection

```python
# Sensitive pattern detection
SENSITIVE_ENV_PATTERNS = [
    "_KEY", "_TOKEN", "_SECRET", "_PASSWORD", "_AUTH",
    "_PRIVATE", "_CREDENTIAL", "API_", "SECRET_", "GITHUB_"
]

# Filtered environment (credentials removed)
safe_env = filter_sensitive_environment()
```

## Developer Guidelines

### 1. File Operations

**✅ DO:**

```python
from mcp_server.utils.security import safe_read_file, safe_write_file

# Use secure file functions
content = safe_read_file(file_path, max_size=1024*1024)
safe_write_file(output_path, content)

# Validate paths before operations
validation = validate_file_path(user_path, "read")
if not validation["valid"]:
    raise ValueError(f"Invalid path: {validation['checks']}")
```

**❌ DON'T:**

```python
# Never use direct file operations without validation
with open(user_provided_path, 'r') as f:  # VULNERABLE
    content = f.read()

# Never trust user paths
Path(user_input).read_text()  # VULNERABLE TO PATH TRAVERSAL
```

### 2. Command Execution

**✅ DO:**

```python
from mcp_server.utils.security import run_command

# Use secure command execution
result = run_command("git log --oneline")
if result["success"]:
    output = result["stdout"]
else:
    error = result["error"]
```

**❌ DON'T:**

```python
# Never use shell=True with user input
subprocess.run(user_command, shell=True)  # COMMAND INJECTION VULNERABILITY

# Never trust user commands
os.system(user_input)  # EXTREMELY DANGEROUS
```

### 3. URL Handling

**✅ DO:**

```python
from mcp_server.tools.search_tools import _validate_url_security

# Validate URLs before fetching
validation = _validate_url_security(user_url)
if not validation["valid"]:
    raise ValueError(f"Invalid URL: {validation['error']}")

# Use secure HTTP client with limits
async with httpx.AsyncClient(timeout=10) as client:
    response = await client.get(validated_url)
```

**❌ DON'T:**

```python
# Never fetch URLs without validation
requests.get(user_url)  # SSRF VULNERABILITY

# Never allow unlimited timeouts or sizes
requests.get(url, timeout=None)  # RESOURCE EXHAUSTION
```

## Security Testing

### Running Security Validation

```bash
# Run comprehensive security tests
python validate_core_security.py

# Expected output:
# ✅ ALL CORE SECURITY TESTS PASSED - System is hardened
```

### Manual Security Testing

```python
# Test path traversal protection
try:
    safe_read_file("../../../etc/passwd")
    print("❌ SECURITY FAILURE")
except ValueError:
    print("✅ Path traversal blocked")

# Test command injection protection  
result = run_command("ls && cat /etc/passwd")
assert not result["success"]
print("✅ Command injection blocked")
```

## Security Configuration

### Current Security Settings

```python
# View security configuration
config = get_security_config()
print(f"Hardening enabled: {config['hardening_enabled']}")
print(f"Allowed commands: {config['allowed_commands']}")
```

### Modifying Security Settings

**⚠️ WARNING:** Only modify security settings if you fully understand the implications.

```python
# Adding new allowed command (requires code change)
ALLOWED_COMMANDS['new_safe_command'] = ['--safe-flag-only']

# Adding allowed directory (requires careful consideration)
ALLOWED_DIRECTORIES.append('/path/to/safe/directory')
```

## Security Monitoring

### Log Security Events

```python
import logging

# Security violations are logged
logging.warning(f"SECURITY: Path traversal attempt blocked: {dangerous_path}")
logging.warning(f"SECURITY: Command injection attempt: {malicious_command}")
```

### Security Metrics

```python
# Track security validation results
security_stats = {
    "path_validation_failures": 0,
    "command_validation_failures": 0,
    "url_validation_failures": 0
}
```

## Incident Response

### Security Violation Detected

1. **Immediate Actions:**
   - Log the security violation with full context
   - Block the operation and return security error
   - Do not expose sensitive system information

2. **Investigation:**
   - Review logs for attack patterns
   - Check if legitimate functionality was blocked
   - Assess if security rules need adjustment

3. **Response:**
   - For legitimate blocks: Adjust allowlists carefully
   - For actual attacks: Enhance monitoring and detection

### Common Security Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Path blocked | "Access denied: outside allowed directories" | Verify path is legitimate, add to allowlist if needed |
| Command blocked | "Security validation failed" | Check if command is in allowlist, add if safe |
| Environment leak | Credentials in output | Verify environment filtering is working |
| Large file blocked | "File too large" | Increase size limit if legitimate |

## Security Updates

### Keeping Security Current

1. **Regular Reviews:**
   - Review security logs monthly
   - Update allowlists as needed
   - Test security validation quarterly

2. **Security Patches:**
   - Monitor security advisories
   - Update dependencies regularly
   - Test after security updates

3. **Threat Model Updates:**
   - Reassess threats annually
   - Update security controls accordingly
   - Document security changes

### Version History

- **v1.0.0** (26/10/25): Initial comprehensive security hardening
  - Command injection protection implemented
  - Path traversal prevention added
  - Environment variable filtering deployed
  - SSRF protection for URL handling
  - Comprehensive security testing suite

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE-78: Command Injection](https://cwe.mitre.org/data/definitions/78.html)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [Python Security Documentation](https://python-security.readthedocs.io/)
- [MCP Security Guidelines](https://modelcontextprotocol.io/docs/concepts/security)
