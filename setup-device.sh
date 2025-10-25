#!/bin/bash
# MCP Server Setup for macOS/Linux - Multi-device deployment

set -e

echo "🚀 Setting up MCP Server for this device..."

# Check if Git is available
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

# Check if uv is available
if ! command -v uv &> /dev/null; then
    echo "📦 Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source ~/.bashrc || source ~/.zshrc || true
fi

# Clone or update the repository
if [ -d "my-mcp-server" ]; then
    echo "🔄 Updating existing repository..."
    cd my-mcp-server
    git pull
else
    echo "📥 Cloning repository..."
    git clone https://github.com/Deejpotter/my-mcp-server.git
    cd my-mcp-server
fi

# Install dependencies
echo "📦 Installing dependencies..."
uv sync

# Test the server
echo "🧪 Testing MCP server..."
uv run python main.py --help

# Create VS Code MCP configuration
echo "⚙️ Setting up VS Code configuration..."

# Determine VS Code config directory
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    VSCODE_CONFIG_DIR="$HOME/Library/Application Support/Code/User"
else
    # Linux
    VSCODE_CONFIG_DIR="$HOME/.config/Code/User"
fi

mkdir -p "$VSCODE_CONFIG_DIR"

cat > "$VSCODE_CONFIG_DIR/mcp.json" << EOF
{
  "mcp": {
    "mcpServers": {
      "my-local-mcp-server": {
        "command": "uv",
        "args": ["run", "python", "main.py"],
        "cwd": "$(pwd)"
      }
    }
  }
}
EOF

echo "✅ Setup complete!"
echo "📍 MCP server installed at: $(pwd)"
echo "🔧 VS Code configuration created at: $VSCODE_CONFIG_DIR/mcp.json"
echo "🚀 Restart VS Code to use your MCP server"