#!/bin/bash
# Permission Troubleshooting Script for MCP Server

echo "🔍 MCP Server Permission Diagnostics"
echo "===================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CURRENT_USER=$(whoami)
PROJECT_DIR=$(pwd)

echo "📋 Basic Information:"
echo "User: $CURRENT_USER"
echo "Project Directory: $PROJECT_DIR"
echo "Current Working Directory: $(pwd)"
echo ""

# Check if we're in the right directory
echo "🔍 Checking project structure..."
if [ ! -f "main.py" ]; then
    echo -e "${RED}❌ main.py not found. Are you in the correct directory?${NC}"
    exit 1
else
    echo -e "${GREEN}✅ main.py found${NC}"
fi

if [ ! -f "pyproject.toml" ]; then
    echo -e "${RED}❌ pyproject.toml not found${NC}"
else
    echo -e "${GREEN}✅ pyproject.toml found${NC}"
fi

echo ""

# Check file permissions
echo "🔒 Checking file permissions..."
echo "main.py permissions: $(ls -la main.py | awk '{print $1, $3, $4}')"
echo "Project directory permissions: $(ls -lad . | awk '{print $1, $3, $4}')"
echo ""

# Check if uv is installed
echo "🐍 Checking Python environment..."
if command -v uv &> /dev/null; then
    echo -e "${GREEN}✅ uv is installed: $(which uv)${NC}"
    echo "uv version: $(uv --version)"
else
    echo -e "${RED}❌ uv is not installed${NC}"
    echo "Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

# Check if virtual environment exists
if [ -d ".venv" ]; then
    echo -e "${GREEN}✅ Virtual environment exists${NC}"
    echo "Python executable: $(ls -la .venv/bin/python* 2>/dev/null || echo 'Not found')"
    echo ".venv permissions: $(ls -lad .venv | awk '{print $1, $3, $4}')"
else
    echo -e "${YELLOW}⚠️ Virtual environment not found${NC}"
    echo "Run: uv sync"
fi

echo ""

# Test basic Python execution
echo "🧪 Testing Python execution..."
if [ -f ".venv/bin/python" ]; then
    if .venv/bin/python --version; then
        echo -e "${GREEN}✅ Python executable works${NC}"
    else
        echo -e "${RED}❌ Python executable failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Python executable not found in .venv${NC}"
fi

echo ""

# Check systemd service if it exists
echo "⚙️ Checking systemd service..."
if [ -f "/etc/systemd/system/mcp-server.service" ]; then
    echo -e "${GREEN}✅ Service file exists${NC}"
    echo "Service file permissions: $(ls -la /etc/systemd/system/mcp-server.service | awk '{print $1, $3, $4}')"
    echo ""
    echo "Service file contents:"
    echo "======================"
    sudo cat /etc/systemd/system/mcp-server.service
    echo "======================"
    echo ""
    
    # Check service status
    echo "Service status:"
    sudo systemctl status mcp-server --no-pager -l || true
    echo ""
    
    # Check recent logs
    echo "Recent service logs (last 20 lines):"
    sudo journalctl -u mcp-server --no-pager -n 20 || true
else
    echo -e "${YELLOW}⚠️ Service file not found${NC}"
fi

echo ""

# Check if we can run the server manually
echo "🚀 Testing manual server execution..."
if command -v uv &> /dev/null && [ -f "main.py" ]; then
    echo "Attempting to run: uv run python main.py --help"
    if timeout 10 uv run python main.py --help; then
        echo -e "${GREEN}✅ Manual execution works${NC}"
    else
        echo -e "${RED}❌ Manual execution failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Cannot test manual execution (uv or main.py missing)${NC}"
fi

echo ""
echo "🔧 Common fixes for permission issues:"
echo "1. Ensure you own the project directory:"
echo "   sudo chown -R $CURRENT_USER:$CURRENT_USER $PROJECT_DIR"
echo ""
echo "2. Recreate virtual environment:"
echo "   rm -rf .venv && uv sync"
echo ""
echo "3. Check SELinux (if enabled):"
echo "   getenforce"
echo "   sudo setsebool -P httpd_can_network_connect 1"
echo ""
echo "4. Reinstall service with correct paths:"
echo "   sudo systemctl stop mcp-server"
echo "   sudo rm /etc/systemd/system/mcp-server.service"
echo "   ./deploy-linux.sh"
echo ""
echo "5. Check for file system issues:"
echo "   df -h ."
echo "   mount | grep $(df . | tail -1 | awk '{print $1}')"