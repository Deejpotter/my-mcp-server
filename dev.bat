@echo off
REM Quick development scripts for uv on Windows

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="--help" goto help
if "%1"=="-h" goto help

REM Check if we're in the right directory
if not exist "main.py" (
    echo [ERROR] main.py not found. Please run this script from the my-mcp-server directory.
    exit /b 1
)

if "%1"=="install" goto install
if "%1"=="setup" goto install
if "%1"=="run" goto run
if "%1"=="start" goto run
if "%1"=="test" goto test
goto unknown

:install
echo [INFO] Installing dependencies...
uv sync
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)
echo [SUCCESS] Dependencies installed!
goto end

:run
echo [INFO] Starting MCP server...
uv run python main.py %2 %3 %4 %5 %6 %7 %8 %9
goto end

:test
echo [INFO] Testing MCP server...
echo {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}}, "clientInfo": {"name": "test", "version": "1.0"}}} | uv run python main.py
goto end

:help
echo 🛠️  MCP Server Development Scripts
echo.
echo Usage: dev.bat ^<command^>
echo.
echo Commands:
echo   install, setup    - Install dependencies with uv
echo   run, start [args] - Run the MCP server with optional arguments
echo   test             - Test the server with a sample request
echo   help             - Show this help message
echo.
echo Examples:
echo   dev.bat install
echo   dev.bat run --log-level DEBUG
echo   dev.bat test
goto end

:unknown
echo [ERROR] Unknown command: %1
echo Run 'dev.bat help' for available commands.
exit /b 1

:end