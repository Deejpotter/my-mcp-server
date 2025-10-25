#!/bin/bash
# Quick development scripts for uv

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    print_error "main.py not found. Please run this script from the my-mcp-server directory."
    exit 1
fi

case "$1" in
    "install"|"setup")
        print_status "Installing dependencies..."
        uv sync
        print_success "Dependencies installed!"
        ;;
    
    "run"|"start")
        print_status "Starting MCP server..."
        uv run python main.py "${@:2}"
        ;;
    
    "test")
        print_status "Testing MCP server..."
        echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "clientInfo": {"name": "test", "version": "1.0"}}}
{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "echo", "arguments": {"message": "Hello from MCP server!"}}}' | uv run python main.py
        ;;
    
    "help"|"--help"|"-h"|"")
        echo "🛠️  MCP Server Development Scripts"
        echo ""
        echo "Usage: ./dev.sh <command>"
        echo ""
        echo "Commands:"
        echo "  install, setup    - Install dependencies with uv"
        echo "  run, start [args] - Run the MCP server with optional arguments"
        echo "  test             - Test the server with a sample request"
        echo "  help             - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./dev.sh install"
        echo "  ./dev.sh run --log-level DEBUG"
        echo "  ./dev.sh test"
        ;;
    
    *)
        print_error "Unknown command: $1"
        echo "Run './dev.sh help' for available commands."
        exit 1
        ;;
esac