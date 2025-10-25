#!/bin/bash
# Cloudflare DNS Setup Script

# You'll need to replace these values:
# - ZONE_ID: Your domain zone ID 
# - TUNNEL_ID: Your existing tunnel ID
# - API_TOKEN: Your Cloudflare API token with Zone:Edit permissions

set -e

# Configuration (replace these values)
DOMAIN="deejpotter.com"
SUBDOMAIN="mcp"
FULL_DOMAIN="mcp.deejpotter.com"
ZONE_ID="YOUR_ZONE_ID_HERE"  # Get from Cloudflare dashboard
TUNNEL_ID="YOUR_TUNNEL_ID_HERE"  # Get from: cloudflared tunnel list
API_TOKEN="YOUR_API_TOKEN_HERE"  # Create at: https://dash.cloudflare.com/profile/api-tokens

echo "🌐 Setting up Cloudflare DNS for $FULL_DOMAIN..."

# Check if required values are set
if [[ "$ZONE_ID" == "YOUR_ZONE_ID_HERE" ]] || [[ "$TUNNEL_ID" == "YOUR_TUNNEL_ID_HERE" ]] || [[ "$API_TOKEN" == "YOUR_API_TOKEN_HERE" ]]; then
    echo "❌ Please update the configuration values in this script first!"
    echo ""
    echo "📋 To get your values:"
    echo "1. Zone ID: Cloudflare Dashboard → Your Domain → Overview (right sidebar)"
    echo "2. Tunnel ID: Run 'cloudflared tunnel list'"
    echo "3. API Token: https://dash.cloudflare.com/profile/api-tokens (Zone:Edit permissions)"
    exit 1
fi

# Create CNAME record pointing to tunnel
echo "📝 Creating DNS record..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
     -H "Authorization: Bearer $API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{
       "type": "CNAME",
       "name": "'$SUBDOMAIN'",
       "content": "'$TUNNEL_ID'.cfargotunnel.com",
       "ttl": 1,
       "comment": "MCP Server tunnel"
     }' | jq '.'

echo ""
echo "✅ DNS record created!"
echo ""
echo "🔧 Next, update your tunnel configuration to route to the MCP server:"
echo "1. Edit your cloudflared config file"
echo "2. Add ingress rule for $FULL_DOMAIN → http://127.0.0.1:8000"
echo "3. Restart cloudflared tunnel"
echo ""
echo "🧪 Test with: curl https://$FULL_DOMAIN/health"