#!/bin/bash
# MCP Server Deployment Script for Linux

set -e

echo "🚀 Deploying MCP Server with Cloudflare Tunnel..."

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ This script is for Linux only"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found. Please run this script from the my-mcp-server directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
uv sync

# Test the HTTP server
echo "🧪 Testing HTTP server..."
uv run python main.py --transport http --help

# Install systemd service
echo "⚙️ Installing systemd service..."
sudo cp mcp-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mcp-server
sudo systemctl start mcp-server

echo "✅ Service installed and started!"

# Check service status
echo "📊 Service status:"
sudo systemctl status mcp-server --no-pager

echo ""
echo "🌐 Next steps for Cloudflare Tunnel:"
echo "1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
echo "2. Create a tunnel: cloudflared tunnel create mcp-server"
echo "3. Update cloudflared-config.yml with your tunnel ID"
echo "4. Run: cloudflared tunnel --config cloudflared-config.yml run"
echo ""
echo "🔧 Useful commands:"
echo "  sudo systemctl status mcp-server    # Check status"
echo "  sudo systemctl restart mcp-server   # Restart service"
echo "  sudo journalctl -u mcp-server -f    # View logs"
echo "  curl http://127.0.0.1:8000          # Test locally"