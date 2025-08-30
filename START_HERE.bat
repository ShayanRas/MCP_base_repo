@echo off
REM ===============================================
REM MCP Base Repository - Quick Start for Windows
REM ===============================================

echo.
echo ========================================
echo    Welcome to MCP Base Repository!
echo    Let's get you started...
echo ========================================
echo.

REM Check if mcp-hub directory exists
if not exist "mcp-hub\start_here.bat" (
    echo Error: mcp-hub directory not found!
    echo Please make sure you're in the correct directory.
    pause
    exit /b 1
)

REM Navigate to mcp-hub and run the setup
cd mcp-hub
call start_here.bat
set SETUP_RESULT=%errorlevel%
cd ..

if %SETUP_RESULT% neq 0 (
    echo.
    echo Setup failed. Please check the errors above.
    pause
    exit /b %SETUP_RESULT%
)

echo.
echo Ready to use MCP Hub!
echo.
echo To start the interactive menu:
echo   PowerShell:  cd mcp-hub; npm run mcp
echo   CMD:         cd mcp-hub ^&^& npm run mcp
echo.
pause