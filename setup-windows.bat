@echo off
:: MCP Server Setup Script for Windows
:: Supports both local development and Docker deployment

echo.
echo 🚀 MCP Server Setup for Windows
echo ==============================

:: Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found. Please install Python 3.12+ from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

:: Check Python version
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo Found Python %PYTHON_VERSION%

:: Ask user for installation type
echo.
echo Choose installation type:
echo 1) Local development (Python virtual environment)
echo 2) Docker deployment (requires Docker Desktop)
set /p INSTALL_TYPE="Enter choice (1 or 2): "

if "%INSTALL_TYPE%"=="1" (
    echo.
    echo 📦 Setting up local Python environment...
    
    :: Create virtual environment
    echo 🐍 Creating Python virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo ❌ Failed to create virtual environment
        pause
        exit /b 1
    )
    
    :: Activate virtual environment
    call .venv\Scripts\activate.bat
    
    :: Install dependencies
    echo 📦 Installing dependencies...
    python -m pip install --upgrade pip
    pip install -e .
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    
    :: Create .env file if it doesn't exist
    if not exist .env (
        echo 📝 Creating .env file...
        copy .env.example .env >nul
        echo ✏️  Please edit .env file with your API keys
    )
    
    echo.
    echo ✅ Local setup complete!
    echo.
    echo To run the server:
    echo   .venv\Scripts\activate
    echo   python main.py
    echo.
    echo For VS Code integration, update your mcp.json with:
    echo   "command": "%CD%\.venv\Scripts\python.exe"
    echo   "args": ["%CD%\main.py"]
    
) else if "%INSTALL_TYPE%"=="2" (
    echo.
    echo 🐳 Setting up Docker deployment...
    
    :: Check if Docker is available
    docker --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Docker not found. Please install Docker Desktop from:
        echo https://www.docker.com/products/docker-desktop/
        pause
        exit /b 1
    )
    
    :: Check if Docker is running
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Docker is not running. Please start Docker Desktop and try again.
        pause
        exit /b 1
    )
    
    :: Check if Docker Compose is available
    docker-compose --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Docker Compose not found. Please update Docker Desktop.
        pause
        exit /b 1
    )
    
    :: Create .env file if it doesn't exist
    if not exist .env (
        echo 📝 Creating .env file...
        copy .env.example .env >nul
        
        :: Generate API key (using Python since it's available)
        for /f %%i in ('python -c "import secrets; print(secrets.token_hex(32))"') do set API_KEY=%%i
        
        :: Replace placeholder in .env file
        powershell -Command "(Get-Content .env) -replace 'your_secure_api_key_here', '%API_KEY%' | Set-Content .env"
        
        echo 🔑 Generated API key: %API_KEY%
        echo ✏️  Please edit .env file with additional API keys if needed
    )
    
    :: Start services
    echo 🚀 Starting MCP server...
    docker-compose up -d
    if %errorlevel% neq 0 (
        echo ❌ Failed to start Docker services
        pause
        exit /b 1
    )
    
    :: Wait and test
    echo ⏳ Waiting for server to start...
    timeout /t 10 /nobreak >nul
    
    :: Test health endpoint
    curl -s http://localhost:8000/health | findstr "healthy" >nul
    if %errorlevel% equ 0 (
        echo ✅ Server running at http://localhost:8000
        
        :: Show API key for VS Code configuration
        for /f "tokens=2 delims==" %%i in ('findstr "MY_SERVER_API_KEY=" .env') do set API_KEY=%%i
        echo.
        echo 🔧 For VS Code remote access, update your mcp.json with:
        echo {
        echo   "mcpServers": {
        echo     "my-mcp-server-remote": {
        echo       "type": "fetch",
        echo       "url": "http://localhost:8000",
        echo       "headers": {
        echo         "X-API-Key": "%API_KEY%"
        echo       }
        echo     }
        echo   }
        echo }
    ) else (
        echo ❌ Health check failed. Check logs: docker-compose logs
    )
    
    echo.
    echo 📋 Useful commands:
    echo   Logs:    docker-compose logs -f
    echo   Stop:    docker-compose down
    echo   Update:  git pull ^&^& docker-compose up -d --build
    echo   Health:  curl http://localhost:8000/health
    echo.
    echo 🌐 For public access, see ADVANCED.md for Cloudflare Tunnel setup
    
) else (
    echo ❌ Invalid choice. Please run the script again and choose 1 or 2.
    pause
    exit /b 1
)

echo.
echo 🎉 Setup complete! Check README.md for usage instructions.
echo.
pause