#!/bin/bash
# Helper script to get Cloudflare information

echo "🔍 Cloudflare Information Gathering"
echo "=================================="
echo ""

echo "📋 You'll need these values for DNS setup:"
echo ""
echo "1. ZONE_ID:"
echo "   → Go to: https://dash.cloudflare.com"
echo "   → Click on your domain (deejpotter.com)"
echo "   → Look for 'Zone ID' in the right sidebar"
echo ""
echo "2. TUNNEL_ID:"
echo "   → Run: cloudflared tunnel list"
echo "   → Copy the ID of your existing tunnel"
echo ""
echo "3. API_TOKEN:"
echo "   → Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "   → Click 'Create Token'"
echo "   → Use 'Custom token' template"
echo "   → Permissions: Zone:Edit"
echo "   → Zone Resources: Include specific zone (deejpotter.com)"
echo ""

echo "🚀 If you have cloudflared installed, let's check your tunnel:"
if command -v cloudflared &> /dev/null; then
    echo ""
    echo "📋 Your existing tunnels:"
    cloudflared tunnel list 2>/dev/null || echo "   (Run 'cloudflared login' if you see an error)"
else
    echo "   cloudflared not found - install from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
fi

echo ""
echo "💡 After you have all values, edit cloudflare-dns-setup.sh and run it!"