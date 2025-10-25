@echo off
:: MCP Server Setup Script for Windows (Local Development)
:: Simple Python setup with uv for VS Code integration

echo.
echo 🚀 MCP Server Setup for Windows (Local Development)
echo ==================================================

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
echo 🐍 Found Python %PYTHON_VERSION%

echo.
echo 📦 Setting up local Python environment...

:: Check if uv is available, install if not
uv --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing uv package manager...
    powershell -Command "irm https://astral.sh/uv/install.ps1 | iex"
    if %errorlevel% neq 0 (
        echo ❌ Failed to install uv
        pause
        exit /b 1
    )
)

:: Sync dependencies with uv
echo 📦 Installing dependencies with uv...
uv sync
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
echo To run the MCP server:
echo   uv run python main.py
echo.
echo For VS Code integration, update your mcp.json with:
echo {
echo   "mcpServers": {
echo     "my-mcp-server": {
echo       "command": "uv",
echo       "args": ["run", "python", "%CD%\\main.py"],
echo       "cwd": "%CD%"
echo     }
echo   }
echo }
echo.
echo 🎉 Setup complete! Check README.md for usage instructions.
echo.
pause