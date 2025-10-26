#!/bin/bash
# MCP Server Setup Script for Linux (Local Development)
# Simple Python virtual environment setup for VS Code integration

set -e

echo "🚀 MCP Server Setup for Linux (Local Development)"
echo "================================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "📦 Setting up local Python environment..."

# Check Python version
if ! command_exists python3; then
    echo "❌ Python 3 not found. Please install Python 3.12+ first."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "🐍 Found Python $PYTHON_VERSION"

# Check if uv is available, install if not
if ! command_exists uv; then
    echo "� Installing uv package manager..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.cargo/env
fi

# Sync dependencies with uv
echo "� Installing dependencies with uv..."
uv sync

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✏️  Please edit .env file with your API keys"
fi

echo "✅ Local setup complete!"
echo ""
echo "To run the MCP server:"
echo "  uv run python main.py"
echo ""
echo "For VS Code integration, update your mcp.json with:"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"my-mcp-server\": {"
echo "      \"command\": \"uv\","
echo "      \"args\": [\"run\", \"python\", \"$(pwd)/main.py\"],"
echo "      \"cwd\": \"$(pwd)\""
echo "    }"
echo "  }"
echo "}"
echo ""
echo "🎉 Setup complete! Check README.md for usage instructions."