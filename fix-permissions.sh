#!/bin/bash
# Permission Fix Script for MCP Server

set -e

echo "🔧 MCP Server Permission Fix"
echo "============================"
echo ""

CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "User: $CURRENT_USER"
echo "Project Directory: $PROJECT_DIR"
echo ""

# Step 1: Fix ownership
echo "1️⃣ Fixing file ownership..."
sudo chown -R $CURRENT_USER:$CURRENT_USER $PROJECT_DIR
echo -e "${GREEN}✅ Ownership fixed${NC}"

# Step 2: Fix permissions
echo ""
echo "2️⃣ Fixing file permissions..."
chmod 755 $PROJECT_DIR
chmod 644 $PROJECT_DIR/*.py
chmod 644 $PROJECT_DIR/*.toml
chmod +x $PROJECT_DIR/*.sh
echo -e "${GREEN}✅ File permissions fixed${NC}"

# Step 3: Clean and recreate virtual environment
echo ""
echo "3️⃣ Recreating virtual environment..."
if [ -d ".venv" ]; then
    rm -rf .venv
    echo "Removed existing .venv"
fi

uv sync
echo -e "${GREEN}✅ Virtual environment recreated${NC}"

# Step 4: Test Python execution
echo ""
echo "4️⃣ Testing Python execution..."
if .venv/bin/python --version; then
    echo -e "${GREEN}✅ Python works${NC}"
else
    echo -e "${RED}❌ Python test failed${NC}"
    exit 1
fi

# Step 5: Test server startup
echo ""
echo "5️⃣ Testing server startup..."
if timeout 5 uv run python main.py --transport http --help > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server can start${NC}"
else
    echo -e "${RED}❌ Server startup failed${NC}"
    echo "Trying to get error details..."
    uv run python main.py --transport http --help
fi

# Step 6: Fix log directory
echo ""
echo "6️⃣ Setting up log directory..."
sudo mkdir -p /var/log/mcp-server
sudo chown $CURRENT_USER:$CURRENT_USER /var/log/mcp-server
sudo chmod 755 /var/log/mcp-server
echo -e "${GREEN}✅ Log directory configured${NC}"

# Step 7: Remove old service if exists
echo ""
echo "7️⃣ Cleaning up old service..."
if sudo systemctl is-active --quiet mcp-server; then
    sudo systemctl stop mcp-server
    echo "Stopped existing service"
fi

if [ -f "/etc/systemd/system/mcp-server.service" ]; then
    sudo rm /etc/systemd/system/mcp-server.service
    sudo systemctl daemon-reload
    echo "Removed old service file"
fi

echo -e "${GREEN}✅ Service cleanup complete${NC}"

echo ""
echo "🎉 Permission fixes applied!"
echo ""
echo "🚀 Next steps:"
echo "1. Run: ./deploy-linux.sh"
echo "2. Start service: sudo systemctl start mcp-server"
echo "3. Check status: sudo systemctl status mcp-server"
echo "4. View logs: sudo journalctl -u mcp-server -f"