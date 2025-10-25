#!/bin/bash
# MCP Server Setup Script for Linux (using uv)

set -e  # Exit on any error

echo "🚀 Setting up MCP Server on Linux with uv..."

# Get current directory
PROJECT_DIR=$(pwd)
echo "Project directory: $PROJECT_DIR"

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found. Please run this script from the my-mcp-server directory."
    exit 1
fi

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source $HOME/.cargo/env
fi

# Install dependencies with uv (this creates venv automatically)
echo "⬇️ Installing dependencies with uv..."
uv sync

# Test the server
echo "🧪 Testing server..."
uv run python main.py --help

# Create VS Code config directory
echo "📁 Creating VS Code configuration..."
mkdir -p ~/.config/Code/User

# Get the Python path from uv
PYTHON_PATH=$(uv run which python)
echo "Python path: $PYTHON_PATH"

# Create MCP configuration
echo "⚙️ Creating MCP configuration..."
cat > ~/.config/Code/User/mcp.json << EOF
{
	"servers": {
		"my-mcp-server": {
			"type": "stdio",
			"command": "${PYTHON_PATH}",
			"args": ["${PROJECT_DIR}/main.py"]
		}
	},
	"inputs": []
}
EOF

echo "✅ Setup complete!"
echo ""
echo "📋 Summary:"
echo "  - Virtual environment: managed by uv"
echo "  - Python executable: ${PYTHON_PATH}"
echo "  - Server script: ${PROJECT_DIR}/main.py"
echo "  - VS Code config: ~/.config/Code/User/mcp.json"
echo ""
echo "🎯 Next steps:"
echo "  1. Reload VS Code on this machine"
echo "  2. Test with GitHub Copilot Chat:"
echo "     - 'Calculate 10 * 5'"
echo "     - 'What time is it?'"
echo "     - 'Echo hello from Linux!'"
echo ""
echo "🔧 To run manually:"
echo "  uv run python main.py"