@echo off
REM ===============================================
REM MCP Hub - Direct Launch from Root
REM ===============================================

echo.
echo ========================================
echo    Launching MCP Hub Manager...
echo ========================================

REM Check for --http flag
echo %* | findstr /C:"--http" >nul
if %errorlevel%==0 (
    echo.
    echo 🌐 HTTP mode enabled - servers will run remotely
)

echo.

REM Check if mcp-hub directory exists
if not exist "mcp-hub\package.json" (
    echo Error: mcp-hub directory not found!
    echo Please make sure you're in the correct directory.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "mcp-hub\node_modules" (
    echo First time setup detected. Installing dependencies...
    cd mcp-hub
    call npm install
    cd ..
    if errorlevel 1 (
        echo.
        echo Failed to install dependencies.
        echo Please run START_HERE.bat first for initial setup.
        pause
        exit /b 1
    )
)

REM Navigate to mcp-hub and launch the menu
cd mcp-hub

REM Pass any arguments to the CLI (e.g., MCP.bat --debug or MCP.bat --supabase)
call npm run mcp -- %*

REM Return to root directory
cd ..

echo.
echo MCP Hub closed.
echo.
echo Available options:
echo   MCP.bat           - Launch interactive menu
echo   MCP.bat --http    - Enable HTTP mode by default
echo   MCP.bat --debug   - Enable debug output
echo   MCP.bat --^<server^> - Quick launch specific server
echo.
pause