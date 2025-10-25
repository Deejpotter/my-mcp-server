@echo off
REM MCP Server Setup Script for Windows (using uv)

echo 🚀 Setting up MCP Server on Windows with uv...

REM Get current directory
set PROJECT_DIR=%cd%

REM Check if we're in the right directory
if not exist "main.py" (
    echo ❌ Error: main.py not found. Please run this script from the my-mcp-server directory.
    pause
    exit /b 1
)

REM Check if uv is installed
uv --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing uv...
    powershell -Command "irm https://astral.sh/uv/install.ps1 | iex"
    if errorlevel 1 (
        echo ❌ Failed to install uv. Please install manually from https://docs.astral.sh/uv/getting-started/installation/
        pause
        exit /b 1
    )
)

REM Install dependencies with uv
echo ⬇️ Installing dependencies with uv...
uv sync
if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Test the server
echo 🧪 Testing server...
uv run python main.py --help
if errorlevel 1 (
    echo ❌ Server test failed
    pause
    exit /b 1
)

REM Get the Python path from uv
for /f "tokens=*" %%i in ('uv run python -c "import sys; print(sys.executable)"') do set PYTHON_PATH=%%i

REM Create VS Code config directory
echo 📁 Creating VS Code configuration...
if not exist "%APPDATA%\Code\User" mkdir "%APPDATA%\Code\User"

REM Create MCP configuration
echo ⚙️ Creating MCP configuration...
(
echo {
echo 	"servers": {
echo 		"my-mcp-server": {
echo 			"type": "stdio",
echo 			"command": "%PYTHON_PATH%",
echo 			"args": ["%PROJECT_DIR%\main.py"]
echo 		}
echo 	},
echo 	"inputs": []
echo }
) > "%APPDATA%\Code\User\mcp.json"

echo.
echo ✅ Setup complete!
echo.
echo 📋 Summary:
echo   - Virtual environment: managed by uv
echo   - Python executable: %PYTHON_PATH%
echo   - Server script: %PROJECT_DIR%\main.py
echo   - VS Code config: %APPDATA%\Code\User\mcp.json
echo.
echo 🎯 Next steps:
echo   1. Reload VS Code
echo   2. Test with GitHub Copilot Chat:
echo      - 'Calculate 10 * 5'
echo      - 'What time is it?'
echo      - 'Echo hello from Windows!'
echo.
echo 🔧 To run manually:
echo   uv run python main.py
echo.
pause