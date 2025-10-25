#!/bin/bash
# MCP Server Deployment Script for Linux

set -e

echo "🚀 Deploying MCP Server..."

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
echo "Starting server in background..."
uv run python main.py --transport http --port 8001 > /tmp/mcp-test.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait longer and check multiple times
for i in {1..10}; do
    sleep 1
    echo "Attempt $i/10: Testing connection..."
    if curl -s http://127.0.0.1:8001/health > /dev/null; then
        echo "✅ HTTP server test passed"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
        break
    elif [ $i -eq 10 ]; then
        echo "❌ HTTP server test failed after 10 attempts"
        echo "Server log output:"
        cat /tmp/mcp-test.log 2>/dev/null || echo "No log file found"
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
        rm -f /tmp/mcp-test.log
        exit 1
    fi
done

rm -f /tmp/mcp-test.log

# Create necessary directories
echo "📁 Setting up directories..."
CURRENT_USER=$(whoami)
sudo mkdir -p /var/log/mcp-server
sudo chown $CURRENT_USER:$CURRENT_USER /var/log/mcp-server

# Install systemd service (without starting yet)
echo "⚙️ Installing systemd service..."

# Get current user and project directory
CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)

# Create a customized service file
cp mcp-server.service mcp-server.service.tmp
sed -i "s|MCP_USER|$CURRENT_USER|g" mcp-server.service.tmp
sed -i "s|MCP_PROJECT_DIR|$PROJECT_DIR|g" mcp-server.service.tmp

# Install the customized service file
sudo cp mcp-server.service.tmp /etc/systemd/system/mcp-server.service
rm mcp-server.service.tmp

sudo systemctl daemon-reload
sudo systemctl enable mcp-server

# Test service configuration
echo "🔍 Testing service configuration..."
sudo systemctl status mcp-server --no-pager || true

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🚀 To start the service:"
echo "  sudo systemctl start mcp-server"
echo ""
echo "🔧 Useful commands:"
echo "  sudo systemctl status mcp-server    # Check status"
echo "  sudo systemctl start mcp-server     # Start service"
echo "  sudo systemctl stop mcp-server      # Stop service"
echo "  sudo systemctl restart mcp-server   # Restart service"
echo "  sudo journalctl -u mcp-server -f    # View logs"
echo "  curl http://127.0.0.1:8000/health   # Test locally"