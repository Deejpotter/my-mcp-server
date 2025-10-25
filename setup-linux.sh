#!/bin/bash
# MCP Server Setup Script for Linux
# Supports both local development and Docker deployment

set -e

echo "🚀 MCP Server Setup for Linux"
echo "=============================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Ask user for installation type
echo "Choose installation type:"
echo "1) Local development (Python virtual environment)"
echo "2) Docker deployment (recommended for production)"
read -p "Enter choice (1 or 2): " INSTALL_TYPE

if [ "$INSTALL_TYPE" = "1" ]; then
    echo "📦 Setting up local Python environment..."
    
    # Check Python version
    if ! command_exists python3; then
        echo "❌ Python 3 not found. Please install Python 3.12+ first."
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    if [ "$(echo "$PYTHON_VERSION < 3.12" | bc -l)" -eq 1 ]; then
        echo "❌ Python 3.12+ required. Found: $PYTHON_VERSION"
        exit 1
    fi
    
    # Create virtual environment
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    pip install --upgrade pip
    pip install -e .
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        echo "📝 Creating .env file..."
        cp .env.example .env
        echo "✏️  Please edit .env file with your API keys"
    fi
    
    echo "✅ Local setup complete!"
    echo ""
    echo "To run the server:"
    echo "  source .venv/bin/activate"
    echo "  python main.py"
    echo ""
    echo "For VS Code integration, update your mcp.json with:"
    echo "  \"command\": \"$(pwd)/.venv/bin/python\""
    echo "  \"args\": [\"$(pwd)/main.py\"]"

elif [ "$INSTALL_TYPE" = "2" ]; then
    echo "🐳 Setting up Docker deployment..."
    
    # Install Docker if needed
    if ! command_exists docker; then
        echo "🐳 Installing Docker..."
        curl -fsSL https://get.docker.com | bash
        sudo usermod -aG docker $USER
        echo "✅ Docker installed (restart terminal or run 'newgrp docker')"
    fi
    
    # Install Docker Compose if needed
    if ! command_exists docker-compose; then
        echo "🔧 Installing Docker Compose..."
        sudo apt update && sudo apt install -y docker-compose
    fi
    
    # Choose compose file based on architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" =~ ^(aarch64|arm64|armv7l)$ ]]; then
        COMPOSE_FILE="docker-compose.orangepi.yml"
        echo "🍊 Detected ARM architecture - using optimized configuration"
    else
        COMPOSE_FILE="docker-compose.yml"
        echo "💻 Using standard x86 configuration"
    fi
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        echo "📝 Creating .env file..."
        cp .env.example .env
        
        # Generate API key
        API_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
        sed -i "s/your_secure_api_key_here/$API_KEY/" .env
        
        echo "🔑 Generated API key: $API_KEY"
        echo "✏️  Please edit .env file with additional API keys if needed"
    fi
    
    # Start services
    echo "🚀 Starting MCP server..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait and test
    echo "⏳ Waiting for server to start..."
    sleep 10
    
    if curl -s http://localhost:8000/health | grep -q "healthy"; then
        echo "✅ Server running at http://localhost:8000"
        
        # Show API key for VS Code configuration
        API_KEY=$(grep "MY_SERVER_API_KEY=" .env | cut -d'=' -f2)
        echo ""
        echo "🔧 For VS Code remote access, update your mcp.json with:"
        echo "{"
        echo "  \"mcpServers\": {"
        echo "    \"my-mcp-server-remote\": {"
        echo "      \"type\": \"fetch\","
        echo "      \"url\": \"http://localhost:8000\","
        echo "      \"headers\": {"
        echo "        \"X-API-Key\": \"$API_KEY\""
        echo "      }"
        echo "    }"
        echo "  }"
        echo "}"
    else
        echo "❌ Health check failed. Check logs: docker-compose -f $COMPOSE_FILE logs"
        exit 1
    fi
    
    echo ""
    echo "📋 Useful commands:"
    echo "  Logs:    docker-compose -f $COMPOSE_FILE logs -f"
    echo "  Stop:    docker-compose -f $COMPOSE_FILE down"
    echo "  Update:  git pull && docker-compose -f $COMPOSE_FILE up -d --build"
    echo "  Health:  curl http://localhost:8000/health"
    
    echo ""
    echo "🌐 For public access, see ADVANCED.md for Cloudflare Tunnel setup"

else
    echo "❌ Invalid choice. Please run the script again and choose 1 or 2."
    exit 1
fi

echo ""
echo "🎉 Setup complete! Check README.md for usage instructions."