# Coolify Deployment Guide for MCP Server

## Prerequisites

- Coolify installed and running
- Domain configured (mcp.deejpotter.com)
- Git repository accessible to Coolify

## Deployment Steps

### 1. Create New Project in Coolify

1. Go to your Coolify dashboard
2. Click "New Project"
3. Name it "mcp-server"

### 2. Add Git Repository

1. Click "New Resource" -> "Git Repository"
2. Add your repository URL: <https://github.com/Deejpotter/my-mcp-server>
3. Set branch to: main
4. Set build pack to: Docker

### 3. Configure Build Settings

- Dockerfile path: `./Dockerfile`
- Docker context: `.`
- Port: `8000`

### 4. Environment Variables

Set these in Coolify's environment section:

```
MCP_LOG_LEVEL=info
MCP_HOST=0.0.0.0
MCP_PORT=8000
```

Optional security variables:

```
MCP_ADMIN_KEY=your-secure-admin-key
MCP_USER_KEY=your-secure-user-key
MCP_PUBLIC_KEY=your-secure-public-key
```

### 5. Domain Configuration

1. Go to "Domains" tab
2. Add domain: `mcp.deejpotter.com`
3. Enable SSL (Let's Encrypt)
4. Enable "Generate wildcard certificate" if needed

### 6. Health Check

Coolify will automatically use the health check defined in docker-compose.yml:

- Endpoint: `/health`
- Interval: 30s
- Timeout: 10s

### 7. Deploy

1. Click "Deploy"
2. Monitor logs for successful deployment
3. Test with: `curl https://mcp.deejpotter.com/health`

## Post-Deployment

- Monitor logs in Coolify dashboard
- Set up automatic deployments on git push
- Configure backup strategy if needed

## Troubleshooting

- Check container logs in Coolify
- Verify environment variables are set
- Ensure domain DNS points to Coolify server
- Check firewall settings for port 8000
