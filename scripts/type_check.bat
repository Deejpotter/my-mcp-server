@echo off
REM Type checking script using mypy for Windows
REM Run this before committing to ensure type safety

echo Running mypy type checker...
echo.

uv run mypy src/ main.py --show-error-codes --pretty

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Type checking passed! No issues found.
    exit /b 0
) else (
    echo.
    echo Type checking failed. Please fix the errors above.
    exit /b 1
)
