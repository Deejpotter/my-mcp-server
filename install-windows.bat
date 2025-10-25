@echo off
REM Simple MCP Server Installer for Windows (Docker Compose)

echo 🚀 MCP Server Installer
echo ======================

REM Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Install Docker Desktop first: https://docker.com
    pause & exit /b 1
)

REM Setup project
set PROJECT_DIR=%USERPROFILE%\mcp-server
if not exist "%PROJECT_DIR%" mkdir "%PROJECT_DIR%"
cd /d "%PROJECT_DIR%"

REM Download project
echo � Downloading project...
curl -L -o main.zip https://github.com/Deejpotter/my-mcp-server/archive/main.zip
powershell -command "Expand-Archive -Path main.zip -DestinationPath . -Force"
xcopy my-mcp-server-main\* . /E /Y >nul
rmdir /s /q my-mcp-server-main
del main.zip

REM Start server
echo 🚀 Starting MCP server...
docker-compose up -d

REM Test
timeout /t 5 /nobreak >nul
curl -s http://localhost:8000/health | findstr "healthy" >nul
if %errorlevel% equ 0 (
    echo ✅ Server running at http://localhost:8000
) else (
    echo ❌ Health check failed. Check: docker-compose logs
)

echo.
echo Next: Setup Cloudflare tunnel to expose your server
echo Commands:
echo   Stop:   docker-compose down
echo   Logs:   docker-compose logs -f
echo   Update: git pull ^&^& docker-compose up -d --build
echo.
pause