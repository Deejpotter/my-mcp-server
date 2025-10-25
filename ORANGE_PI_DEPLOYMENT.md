# Orange Pi MCP Server Deployment Guide

## Prerequisites for Orange Pi

### 1. Install Docker on Orange Pi

```fish
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker

# Verify Docker installation
docker --version
docker run hello-world
```

### 2. Install Docker Compose (if not included)

```fish
# Install docker-compose
sudo apt install docker-compose -y

# Or install latest version
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. Install Cloudflared for Orange Pi

```fish
# Download ARM64 version (most Orange Pi 5 series)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# For ARM32 (older Orange Pi models)
# wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm
# sudo mv cloudflared-linux-arm /usr/local/bin/cloudflared
# sudo chmod +x /usr/local/bin/cloudflared

# Verify installation
cloudflared --version
```

## Deployment Steps

### 1. Clone and Build on Orange Pi

```fish
# Clone your repo to Orange Pi
git clone https://github.com/Deejpotter/my-mcp-server.git
cd my-mcp-server

# Build the ARM-optimized image
docker-compose -f docker-compose.orangepi.yml build

# Start the service
docker-compose -f docker-compose.orangepi.yml up -d

# Check status
docker-compose -f docker-compose.orangepi.yml ps
docker-compose -f docker-compose.orangepi.yml logs -f
```

### 2. Test Local Service

```fish
# Test health endpoint
curl -s http://localhost:8000/health

# Test root endpoint
curl -s http://localhost:8000/

# Test MCP endpoint
curl -s -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
```

### 3. Setup Cloudflare Tunnel

```fish
# Login to Cloudflare
cloudflared tunnel login

# Create a tunnel (only once)
cloudflared tunnel create mcp-orangepi

# Note the tunnel ID from output, then update config
# Edit ~/.cloudflared/config.yml:
```

Example config file (`~/.cloudflared/config.yml`):

```yaml
tunnel: YOUR_TUNNEL_ID_HERE
credentials-file: /home/your-user/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: mcp.deejpotter.com
    service: http://127.0.0.1:8000
  - service: http_status:404
```

```fish
# Route DNS
cloudflared tunnel route dns YOUR_TUNNEL_ID mcp.deejpotter.com

# Test tunnel (foreground)
cloudflared tunnel --config ~/.cloudflared/config.yml run YOUR_TUNNEL_ID

# Install as system service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

### 4. Verify Everything Works

```fish
# Test from anywhere
curl -s https://mcp.deejpotter.com/health

# Check Docker logs
docker-compose -f docker-compose.orangepi.yml logs -f

# Check cloudflared logs
sudo journalctl -u cloudflared -f
```

## Orange Pi Specific Optimizations

### Memory Management

- Limited memory to 512MB in compose file
- Reduced health check intervals
- Log rotation enabled

### Performance Tips

```fish
# Monitor resource usage
docker stats

# If needed, increase swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Auto-start on Boot

```fish
# Enable Docker to start on boot
sudo systemctl enable docker

# Docker Compose auto-start
# Add to crontab
crontab -e
# Add line:
@reboot cd /home/your-user/my-mcp-server && docker-compose -f docker-compose.orangepi.yml up -d
```

### Troubleshooting

```fish
# Check Orange Pi architecture
uname -m
# arm64 = use arm64 binaries
# armv7l = use arm32 binaries

# Check available memory
free -h

# If build fails due to memory, try:
docker system prune -a
# Or add swap space as shown above
```
