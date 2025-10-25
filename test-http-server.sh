#!/bin/bash
# Quick test script for HTTP server

echo "🧪 Manual HTTP Server Test"
echo "=========================="

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo "❌ curl is not installed. Install with: sudo apt install curl"
    exit 1
fi

echo "Starting MCP server in background..."
uv run python main.py --transport http --port 8001 > /tmp/mcp-manual-test.log 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "Waiting for server to start..."

# Wait and test
for i in {1..15}; do
    sleep 1
    echo -n "."
    
    if curl -s http://127.0.0.1:8001/health > /dev/null; then
        echo ""
        echo "✅ Server is responding!"
        echo ""
        echo "Testing endpoints:"
        echo "📍 Root endpoint:"
        curl -s http://127.0.0.1:8001/ | jq '.' || curl -s http://127.0.0.1:8001/
        echo ""
        echo "📍 Health endpoint:"
        curl -s http://127.0.0.1:8001/health | jq '.' || curl -s http://127.0.0.1:8001/health
        echo ""
        break
    elif [ $i -eq 15 ]; then
        echo ""
        echo "❌ Server failed to start after 15 seconds"
        echo ""
        echo "📋 Server log output:"
        echo "===================="
        cat /tmp/mcp-manual-test.log 2>/dev/null || echo "No log file found"
        echo "===================="
    fi
done

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
rm -f /tmp/mcp-manual-test.log
echo "✅ Test complete"