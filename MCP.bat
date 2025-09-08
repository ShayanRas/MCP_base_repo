@echo off
REM ===============================================
REM MCP Hub - Direct Launch from Root
REM ===============================================

echo.
echo ========================================
echo    Launching MCP Hub Manager...
echo ========================================
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
echo To run again: MCP.bat
echo.
pause