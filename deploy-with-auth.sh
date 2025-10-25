#!/bin/bash
# Deployment script for MCP server with API key

echo "🚀 Deploying MCP Server with Authentication..."

# Read API key from .env file
if [ -f .env ]; then
    source .env
    echo "✅ API key loaded from .env file"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t my-mcp-server:latest .

# Stop existing container
echo "🛑 Stopping existing container..."
docker stop my-mcp-server 2>/dev/null || true
docker rm my-mcp-server 2>/dev/null || true

# Run new container with environment variables
echo "🚀 Starting new container with authentication..."
docker run -d \
  --name my-mcp-server \
  --restart unless-stopped \
  -p 8000:8000 \
  -e MY_SERVER_API_KEY="$MY_SERVER_API_KEY" \
  -e GITHUB_TOKEN="$GITHUB_TOKEN" \
  -e CLICKUP_API_TOKEN="$CLICKUP_API_TOKEN" \
  -e BOOKSTACK_URL="$BOOKSTACK_URL" \
  -e BOOKSTACK_TOKEN_ID="$BOOKSTACK_TOKEN_ID" \
  -e BOOKSTACK_TOKEN_SECRET="$BOOKSTACK_TOKEN_SECRET" \
  my-mcp-server:latest

# Wait for container to start
echo "⏳ Waiting for container to start..."
sleep 5

# Test the deployment
echo "🧪 Testing deployment..."
echo "Health check:"
curl -s http://localhost:8000/health | python -m json.tool

echo -e "\nTesting authentication:"
if curl -s -X POST "http://localhost:8000/" \
   -H "Content-Type: application/json" \
   -H "X-API-Key: $MY_SERVER_API_KEY" \
   -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -q '"result"'; then
    echo "✅ Authentication working!"
else
    echo "❌ Authentication failed!"
fi

echo "🎉 Deployment complete!"
echo "📝 Container logs:"
docker logs my-mcp-server --tail 10