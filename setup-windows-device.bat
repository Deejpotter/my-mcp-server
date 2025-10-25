@echo off
REM MCP Server Setup for Windows - Multi-device deployment
echo 🚀 Setting up MCP Server for this Windows device...

REM Check if Git is available
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is not installed. Please install Git first.
    exit /b 1
)

REM Check if uv is available
uv --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing uv...
    powershell -Command "irm https://astral.sh/uv/install.ps1 | iex"
    refreshenv
)

REM Clone or update the repository
if exist "my-mcp-server" (
    echo 🔄 Updating existing repository...
    cd my-mcp-server
    git pull
) else (
    echo 📥 Cloning repository...
    git clone https://github.com/Deejpotter/my-mcp-server.git
    cd my-mcp-server
)

REM Install dependencies
echo 📦 Installing dependencies...
uv sync

REM Test the server
echo 🧪 Testing MCP server...
uv run python main.py --help

REM Create VS Code MCP configuration
echo ⚙️ Setting up VS Code configuration...
if not exist "%APPDATA%\Code\User" mkdir "%APPDATA%\Code\User"

(
echo {
echo   "mcp": {
echo     "mcpServers": {
echo       "my-local-mcp-server": {
echo         "command": "uv",
echo         "args": ["run", "python", "main.py"],
echo         "cwd": "%CD%"
echo       }
echo     }
echo   }
echo }
) > "%APPDATA%\Code\User\mcp.json"

echo ✅ Setup complete!
echo 📍 MCP server installed at: %CD%
echo 🔧 VS Code configuration created at: %APPDATA%\Code\User\mcp.json
echo 🚀 Restart VS Code to use your MCP server
pause