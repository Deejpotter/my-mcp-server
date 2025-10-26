# Security Implementation Guide

This guide provides step-by-step instructions for implementing the security fixes identified in the [Security Audit Report](SECURITY_AUDIT_REPORT.md).

## 🚨 Critical Fixes (Implement Immediately)

### 1. Secure Command Execution

**Replace the current `run_command` function:**

```python
# In src/mcp_server/utils/security.py - UPDATE THIS:
from .security_hardened import secure_run_command as run_command
```

**Or manually update to use the hardened version:**

```python
# In src/mcp_server/tools/system_commands.py
from ..utils.security_hardened import secure_run_command

# Update the handler:
result = secure_run_command(command, cwd, timeout)
```

### 2. Secure File Operations

**Update file operation imports:**

```python
# In src/mcp_server/tools/file_operations.py
from ..utils.security_hardened import secure_read_file, secure_write_file

# Update function calls:
content = secure_read_file(file_path, max_size)
secure_write_file(file_path, content)
```

### 3. Environment Variable Security

**Update resources.py:**

```python
# In src/mcp_server/resources.py
from .utils.security_hardened import filter_sensitive_environment

# Replace the environment section with:
"environment_variables": filter_sensitive_environment(),
```

## ⚠️ Configuration Updates

### 4. Command Whitelist Configuration

**Create a security configuration file:**

```python
# src/mcp_server/config/security.py
ALLOWED_COMMANDS = {
    'git': ['status', 'log', 'diff', 'show', 'branch', 'remote'],
    'ls': [],
    'pwd': [],
    'echo': [],
    # Add more as needed
}

ALLOWED_DIRECTORIES = [
    os.getcwd(),  # Current directory only
    # Add specific allowed paths
]
```

### 5. Input Validation

**Add validation middleware:**

```python
# In each tool handler, add:
def validate_input(arguments: Dict[str, Any]) -> None:
    for key, value in arguments.items():
        if isinstance(value, str):
            # Check for injection patterns
            dangerous_patterns = ['../', '..\\', '${', '`', ';', '|']
            if any(pattern in value for pattern in dangerous_patterns):
                raise ValueError(f"Invalid input detected in {key}")
```

## 🔧 Testing Security Fixes

### Test Command Validation

```bash
# These should be BLOCKED:
python -c "
from src.mcp_server.utils.security_hardened import validate_command
print('rm -rf /', validate_command('rm -rf /'))  # Should be False
print('ls; cat /etc/passwd', validate_command('ls; cat /etc/passwd'))  # Should be False
print('git status', validate_command('git status'))  # Should be True
"
```

### Test Path Validation

```bash
# These should be BLOCKED:
python -c "
from src.mcp_server.utils.security_hardened import validate_file_path
print('../../../etc/passwd', validate_file_path('../../../etc/passwd'))  # Should be False
print('/etc/shadow', validate_file_path('/etc/shadow'))  # Should be False
print('./README.md', validate_file_path('./README.md'))  # Should be True
"
```

## 📋 Implementation Checklist

### Critical Security Fixes

- [ ] Replace `subprocess.run(shell=True)` with secure command execution
- [ ] Implement path traversal protection for file operations
- [ ] Add environment variable filtering
- [ ] Implement command whitelist validation
- [ ] Add input sanitization for all user inputs

### Medium Priority

- [ ] Add rate limiting for command execution
- [ ] Implement audit logging for security events
- [ ] Configure secure HTTP client settings
- [ ] Add file type validation
- [ ] Implement content size limits

### Validation Steps

- [ ] Test command injection protection
- [ ] Test path traversal protection  
- [ ] Verify environment variable filtering
- [ ] Test file operation restrictions
- [ ] Verify error message sanitization

### Documentation Updates

- [ ] Update API documentation with security notes
- [ ] Add security guidelines for contributors
- [ ] Document allowed commands and paths
- [ ] Create incident response procedures

## 🚀 Quick Implementation Script

Run this script to quickly implement critical fixes:

```bash
#!/bin/bash
# security_quickfix.sh

echo "🔒 Implementing critical security fixes..."

# 1. Update imports to use hardened security functions
sed -i 's/from \.\.utils\.security import/from ..utils.security_hardened import secure_read_file as safe_read_file, secure_write_file as safe_write_file, secure_run_command as run_command/g' src/mcp_server/tools/*.py

# 2. Update resources to filter environment variables
sed -i 's/from \.utils\.security import/from .utils.security_hardened import filter_sensitive_environment/g' src/mcp_server/resources.py

echo "✅ Critical fixes implemented!"
echo "⚠️  Please test thoroughly before deployment"
echo "📚 See SECURITY_AUDIT_REPORT.md for complete details"
```

## 🔍 Verification Commands

After implementing fixes, run these verification commands:

```bash
# Test the server starts without errors
python main.py --log-level DEBUG &
sleep 2
kill %1

# Test command validation
python -c "
from src.mcp_server.utils.security_hardened import validate_command
assert not validate_command('rm -rf /')
assert validate_command('git status')
print('✅ Command validation working')
"

# Test path validation  
python -c "
from src.mcp_server.utils.security_hardened import validate_file_path
assert not validate_file_path('/etc/passwd')
assert validate_file_path('./README.md')
print('✅ Path validation working')
"
```

## 🆘 Emergency Procedures

If you discover active exploitation:

1. **Immediately stop the server**
2. **Check system logs for suspicious activity**
3. **Review recent file modifications**
4. **Implement the critical fixes before restarting**
5. **Monitor system activity closely**

## 📞 Support

For security-related questions or to report vulnerabilities:

- Create an issue with the `security` label
- Include steps to reproduce
- Do not include sensitive information in public issues

---

**Remember:** Security is an ongoing process. Regularly review and update these measures!
