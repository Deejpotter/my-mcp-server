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

# Install dependencies using uv sync (faster and uses lock file)
RUN uv sync --frozen --no-dev

# Copy the main application file
COPY main.py ./

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run the application using uv
CMD ["uv", "run", "python", "main.py", "--transport", "http", "--host", "0.0.0.0", "--port", "8000"]