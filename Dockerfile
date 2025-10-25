FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Install uv first
RUN pip install uv

# Copy requirements for dependency installation
COPY pyproject.toml uv.lock* ./

# Install dependencies without building the package
RUN uv pip install --system mcp httpx click requests fastapi uvicorn[standard]

# Copy the main application file
COPY main.py ./

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run the application directly
CMD ["python", "main.py", "--transport", "http", "--host", "0.0.0.0", "--port", "8000"]