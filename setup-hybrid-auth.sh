#!/bin/bash
# Hybrid Authentication Setup Script

echo "🔗 Setting up Hybrid Authentication for MCP Server"
echo "=================================================="

# Generate API keys
echo "🔑 Generating API keys..."
COPILOT_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
CLI_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
PERSONAL_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# Save to .env file
cat > .env << EOF
# Hybrid Authentication Keys - Generated $(date)
MCP_COPILOT_KEY=$COPILOT_KEY
MCP_CLI_KEY=$CLI_KEY
MCP_PERSONAL_KEY=$PERSONAL_KEY

# Server Configuration
MCP_AUTH_MODE=hybrid
MCP_LOG_LEVEL=INFO
EOF

echo "✅ API keys saved to .env file"

# Create VS Code configuration
echo "⚙️ Creating VS Code configuration..."
mkdir -p ~/.config/Code/User

# Replace the placeholder with actual key
sed "s/\${MCP_COPILOT_KEY}/$COPILOT_KEY/g" vscode-hybrid-config.json > ~/.config/Code/User/mcp-hybrid.json

echo "✅ VS Code config saved to ~/.config/Code/User/mcp-hybrid.json"

# Update Cloudflare tunnel config
echo "🌐 Updating Cloudflare tunnel configuration..."

if [ -f ~/.cloudflared/config.yml ]; then
    # Backup original
    cp ~/.cloudflared/config.yml ~/.cloudflared/config.yml.backup
    
    # Check if api subdomain already exists
    if ! grep -q "api.mcp.deejpotter.com" ~/.cloudflared/config.yml; then
        echo "Adding API subdomain to Cloudflare config..."
        
        # Find the tunnel ID from existing config
        TUNNEL_ID=$(grep "tunnel:" ~/.cloudflared/config.yml | cut -d' ' -f2 | tr -d '<>')
        
        # Create new config with API subdomain
        cat > ~/.cloudflared/config.yml << EOF
tunnel: <$TUNNEL_ID>
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  # Web access with Cloudflare Access (OAuth)
  - hostname: mcp.deejpotter.com
    service: http://127.0.0.1:8000
    originRequest:
      access:
        required: true
  
  # API access without Cloudflare Access (API keys)
  - hostname: api.mcp.deejpotter.com  
    service: http://127.0.0.1:8000
    originRequest:
      access:
        required: false
  
  # Your existing services
  - hostname: pi.deejpotter.com
    service: ssh://localhost:22
  - hostname: coolify.deejpotter.com
    service: http://localhost:3000
  - hostname: deejpotter.com
    service: http://localhost:5000
  - hostname: cnctools.deejpotter.com
    service: http://localhost:5001
  
  - service: http_status:404
EOF
        echo "✅ Cloudflare config updated"
    else
        echo "✅ API subdomain already configured in Cloudflare"
    fi
else
    echo "⚠️  Cloudflare config not found - you'll need to update it manually"
fi

# Create DNS record for API subdomain
echo "📋 DNS Configuration Needed:"
echo "Add this CNAME record in Cloudflare Dashboard:"
echo "  Name: api.mcp"
echo "  Value: $TUNNEL_ID.cfargotunnel.com"
echo ""

# Test the setup
echo "🧪 Testing setup..."

# Check if the server can start
if python3 hybrid_auth_main.py --help > /dev/null 2>&1; then
    echo "✅ Hybrid server ready"
else
    echo "❌ Server setup issue - check dependencies"
fi

# Display configuration
echo ""
echo "🎉 Hybrid Authentication Setup Complete!"
echo "========================================"
echo ""
echo "📋 Your API Keys:"
echo "  Copilot Key: $COPILOT_KEY"
echo "  CLI Key:     $CLI_KEY"
echo "  Personal:    $PERSONAL_KEY"
echo ""
echo "🌐 Access URLs:"
echo "  Browser:  https://mcp.deejpotter.com (Google OAuth)"
echo "  API:      https://api.mcp.deejpotter.com (API keys)"
echo ""
echo "🚀 Next Steps:"
echo "1. Add DNS record: api.mcp.deejpotter.com → $TUNNEL_ID.cfargotunnel.com"
echo "2. Set up Cloudflare Access for mcp.deejpotter.com"
echo "3. Restart cloudflared: sudo systemctl restart cloudflared"
echo "4. Start server: uv run python hybrid_auth_main.py --transport http"
echo "5. Test browser: https://mcp.deejpotter.com"
echo "6. Test API: curl -H 'X-MCP-CLI-Key: $CLI_KEY' https://api.mcp.deejpotter.com/health"
echo ""
echo "📝 VS Code Configuration:"
echo "Copy this to your VS Code settings.json:"
echo ""
cat ~/.config/Code/User/mcp-hybrid.json
echo ""
echo "💾 Configuration files created:"
echo "  - .env (API keys)"
echo "  - ~/.config/Code/User/mcp-hybrid.json (VS Code config)"
echo "  - ~/.cloudflared/config.yml (updated tunnel config)"