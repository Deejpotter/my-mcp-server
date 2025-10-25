# Security Configuration for MCP Server

## 🔐 Security Layers

### 1. **API Key Authentication**

```bash
# Generate secure API keys
python -c "import secrets; print('Admin Key:', secrets.token_urlsafe(32))"
python -c "import secrets; print('User Key:', secrets.token_urlsafe(32))"
python -c "import secrets; print('Public Key:', secrets.token_urlsafe(32))"
```

### 2. **Environment Variables**

```bash
# Set these in your environment
export MCP_ADMIN_KEY="your-generated-admin-key"
export MCP_USER_KEY="your-generated-user-key"
export MCP_PUBLIC_KEY="your-generated-public-key"
```

### 3. **Role-Based Access Control**

| Role | Permissions | Use Case |
|------|-------------|----------|
| **admin** | system, personal, files, public | Your personal access |
| **user** | personal, public | Trusted users/devices |
| **public** | public | Public/demo access |

### 4. **Rate Limiting**

| Role | Requests/Minute |
|------|----------------|
| **admin** | 1000 |
| **user** | 100 |
| **public** | 20 |

### 5. **Secure Directories**

- **Personal**: `~/secure_mcp_data/` - Your private data
- **Files**: `~/Documents/` - Document access
- **Logs**: `mcp_audit.log` - Security audit trail

## 🛡️ Implementation Options

### Option 1: **Cloudflare Access (Recommended)**

Add authentication at the tunnel level:

```yaml
# In your Cloudflare tunnel config
ingress:
  - hostname: mcp.deejpotter.com
    service: http://127.0.0.1:8000
    originRequest:
      access:
        required: true
        teamName: your-team
        policyId: your-policy-id
```

### Option 2: **Nginx Reverse Proxy**

Add authentication layer before your MCP server:

```nginx
server {
    listen 443 ssl;
    server_name mcp.deejpotter.com;
    
    # Basic auth for quick protection
    auth_basic "MCP Server";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    # Or OAuth/OIDC integration
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header X-API-Key $http_authorization;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 3: **Application-Level Security**

Use the secure_main.py with API keys:

```python
# In HTTP requests, include:
headers = {
    "Authorization": "Bearer your-api-key",
    "X-API-Key": "your-api-key"
}
```

## 🔧 Quick Setup

### 1. **Generate Keys**

```bash
cd my-mcp-server
python generate_keys.py
```

### 2. **Set Environment**

```bash
# Linux/macOS
source .env

# Windows
set-env.bat
```

### 3. **Create Secure Directories**

```bash
mkdir -p ~/secure_mcp_data
chmod 700 ~/secure_mcp_data
echo "My private notes" > ~/secure_mcp_data/notes.txt
```

### 4. **Test Security**

```bash
# Public access (limited)
curl https://mcp.deejpotter.com/health

# Authenticated access
curl -H "X-API-Key: your-user-key" https://mcp.deejpotter.com/personal
```

## 🚨 Security Best Practices

### **For Personal Data:**

- ✅ Store in `~/secure_mcp_data/`
- ✅ Use admin API key only
- ✅ Enable audit logging
- ✅ Regular key rotation

### **For Public Access:**

- ✅ Rate limiting (20 req/min)
- ✅ Limited tool access
- ✅ No file system access
- ✅ Audit all requests

### **For Production:**

- ✅ Use Cloudflare Access
- ✅ Enable audit logging
- ✅ Monitor rate limits
- ✅ Regular security reviews

## 🔄 Migration Strategy

### **Phase 1: Add Authentication**

Keep existing server, add auth layer

### **Phase 2: Implement RBAC**

Migrate to role-based permissions

### **Phase 3: Secure Data**

Move sensitive data to protected endpoints

### **Phase 4: Full Security**

Complete audit, monitoring, and compliance
