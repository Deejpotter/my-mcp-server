#!/bin/bash
# Simple MCP Server Installer for Linux (Docker Compose)

set -e

echo "🚀 MCP Server Installer"
echo "======================"

# Install Docker if needed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com | bash
    sudo usermod -aG docker $USER
    echo "✅ Docker installed (restart terminal or run 'newgrp docker')"
fi

# Install Docker Compose if needed
if ! command -v docker-compose &> /dev/null; then
    echo "🔧 Installing Docker Compose..."
    sudo apt update && sudo apt install -y docker-compose
fi

# Clone/update project
PROJECT_DIR="$HOME/mcp-server"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "� Cloning project..."
    git clone https://github.com/Deejpotter/my-mcp-server.git "$PROJECT_DIR"
else
    echo "📥 Updating project..."
    cd "$PROJECT_DIR" && git pull
fi

cd "$PROJECT_DIR"

# Choose compose file based on architecture
if [[ $(uname -m) =~ ^(aarch64|arm64|armv7l)$ ]]; then
    COMPOSE_FILE="docker-compose.orangepi.yml"
    echo "🍊 Using ARM configuration"
else
    COMPOSE_FILE="docker-compose.yml"
    echo "💻 Using standard configuration"
fi

# Start server
echo "🚀 Starting MCP server..."
docker-compose -f "$COMPOSE_FILE" up -d

# Test
sleep 5
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo "✅ Server running at http://localhost:8000"
else
    echo "❌ Health check failed. Check logs: docker-compose -f $COMPOSE_FILE logs"
fi

echo ""
echo "Next: Setup Cloudflare tunnel to expose your server"
echo "Commands:"
echo "  Stop:   docker-compose -f $COMPOSE_FILE down"
echo "  Logs:   docker-compose -f $COMPOSE_FILE logs -f"
echo "  Update: git pull && docker-compose -f $COMPOSE_FILE up -d --build"