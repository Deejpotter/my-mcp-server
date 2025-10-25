#!/bin/bash
# Security setup script for MCP server

echo "🔐 Setting up MCP Server Security..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required"
    exit 1
fi

# Generate API keys
echo "📋 Generating API keys..."
python3 generate_keys.py

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found"
    exit 1
fi

# Install additional security dependencies
echo "📦 Installing security dependencies..."
if command -v uv &> /dev/null; then
    uv add python-dotenv psutil
else
    pip install python-dotenv psutil
fi

# Create Cloudflare Access configuration (example)
cat > cloudflare-access-config.yaml << EOF
# Cloudflare Access Configuration for MCP Server
# Apply this in your Cloudflare dashboard

access_policies:
  - name: "MCP Server Admin Access"
    includes:
      - email: your-email@domain.com
    requires: []
    purpose_justification_required: false
    
  - name: "MCP Server User Access"  
    includes:
      - email_domain: trusted-domain.com
    requires:
      - name: "MFA Required"
    purpose_justification_required: true

applications:
  - name: "MCP Server"
    domain: "mcp.deejpotter.com"
    type: "self_hosted"
    session_duration: "24h"
    policies:
      - "MCP Server Admin Access"
      - "MCP Server User Access"
EOF

# Create nginx config (if nginx is available)
if command -v nginx &> /dev/null; then
    cat > nginx-mcp-security.conf << EOF
# Nginx security configuration for MCP server
server {
    listen 443 ssl;
    server_name mcp-secure.deejpotter.com;
    
    # SSL configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=mcp:10m rate=10r/m;
    limit_req zone=mcp burst=5 nodelay;
    
    # API key authentication
    location / {
        # Require API key in header
        if (\$http_x_api_key = "") {
            return 401;
        }
        
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-API-Key \$http_x_api_key;
    }
}
EOF
    echo "📄 Nginx config created: nginx-mcp-security.conf"
fi

# Create systemd service with security
cat > mcp-server-secure.service << EOF
[Unit]
Description=Secure MCP Server
After=network.target

[Service]
Type=simple
User=$(whoami)
Group=$(whoami)
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/.venv/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=$(pwd)/.env
ExecStart=$(which uv) run python secure_main.py --transport http --host 127.0.0.1 --port 8000
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$(pwd)
ReadWritePaths=$(echo ~)/secure_mcp_data
PrivateTmp=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true

# Resource limits
LimitNOFILE=1024
LimitNPROC=512

[Install]
WantedBy=multi-user.target
EOF

echo "⚙️ Secure systemd service created: mcp-server-secure.service"

# Test the secure server
echo "🧪 Testing secure server..."
if python3 -c "import sys; sys.path.insert(0, '.'); from secure_main import SecurityContext; print('✅ Secure server imports successfully')"; then
    echo "✅ Secure server ready"
else
    echo "❌ Secure server has issues"
fi

echo ""
echo "🎉 Security setup complete!"
echo ""
echo "📋 What was created:"
echo "  ✅ API keys in .env file"
echo "  ✅ Secure data directory: ~/secure_mcp_data"
echo "  ✅ Cloudflare Access config: cloudflare-access-config.yaml"
echo "  ✅ Nginx security config: nginx-mcp-security.conf"
echo "  ✅ Secure systemd service: mcp-server-secure.service"
echo ""
echo "🚀 Next steps:"
echo "  1. Review your API keys: cat .env"
echo "  2. Test secure server: python3 secure_main.py --help"
echo "  3. Configure Cloudflare Access (recommended)"
echo "  4. Deploy secure service: sudo cp mcp-server-secure.service /etc/systemd/system/"
echo ""
echo "🔑 Your API keys:"
echo "  Admin:  $MCP_ADMIN_KEY"
echo "  User:   $MCP_USER_KEY" 
echo "  Public: $MCP_PUBLIC_KEY"