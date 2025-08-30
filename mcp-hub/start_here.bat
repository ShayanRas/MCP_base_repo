@echo off
setlocal enabledelayedexpansion

REM ===============================================
REM MCP Hub Setup Script for Windows
REM ===============================================

echo.
echo ========================================
echo    MCP Hub - Initial Setup
echo    Making MCP Easy for Everyone
echo ========================================
echo.

REM Check if Node.js is installed
echo [1/6] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo    X Node.js is not installed!
    echo    Please install Node.js 18+ from: https://nodejs.org/
    echo    After installing, run this script again.
    pause
    exit /b 1
) else (
    echo    + Node.js found
)

REM Check if Python is installed
echo [2/6] Checking Python...
where python >nul 2>&1
if errorlevel 1 (
    where py >nul 2>&1
    if errorlevel 1 (
        echo    X Python is not installed!
        echo    Please install Python 3.10+ from: https://www.python.org/downloads/
        echo    IMPORTANT: Check "Add Python to PATH" during installation!
        echo    After installing, run this script again.
        pause
        exit /b 1
    ) else (
        echo    + Python found ^(using py launcher^)
        set PYTHON_CMD=py
    )
) else (
    echo    + Python found
    set PYTHON_CMD=python
)

REM Check if Git is installed
echo [3/6] Checking Git...
where git >nul 2>&1
if errorlevel 1 (
    echo    X Git is not installed!
    echo    Please install Git from: https://git-scm.com/download/win
    echo    After installing, run this script again.
    pause
    exit /b 1
) else (
    echo    + Git found
)

REM Check if npm is available
echo [4/6] Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo    X npm is not available!
    echo    This should come with Node.js. Please reinstall Node.js.
    pause
    exit /b 1
) else (
    echo    + npm found
)

REM Check/Install UV package manager
echo [5/6] Checking UV package manager...
"%USERPROFILE%\.local\bin\uv.exe" --version >nul 2>&1
if errorlevel 1 (
    echo    - UV not found, installing...
    echo    This may take a minute...
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex" >nul 2>&1
    if errorlevel 1 (
        echo    X Failed to install UV package manager
        echo    You can install it manually from: https://github.com/astral-sh/uv
        echo    Or continue without Python server support
        pause
    ) else (
        echo    + UV package manager installed successfully
    )
) else (
    for /f "tokens=2" %%i in ('"%USERPROFILE%\.local\bin\uv.exe" --version') do set UV_VER=%%i
    echo    + UV !UV_VER! found
)

REM Check current directory
echo [6/6] Checking current directory...
if not exist "hub\cli.js" (
    echo    X This script must be run from the mcp-hub directory!
    echo    Please navigate to the mcp-hub folder and run again.
    pause
    exit /b 1
) else (
    echo    + Running from correct directory
)

echo.
echo ========================================
echo    Installing MCP Hub Components
echo ========================================
echo.

REM Run the Node.js setup script
echo Starting setup process...
echo.

REM Install hub dependencies first
echo Installing hub dependencies...
call npm install
if errorlevel 1 (
    echo    X Failed to install hub dependencies
    pause
    exit /b 1
)

REM Run the main setup
node hub/setup.js
if errorlevel 1 (
    echo.
    echo    X Setup encountered an error
    echo    Please check the messages above and try again
    pause
    exit /b 1
)

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo Your MCP Hub is ready to use!
echo.
echo To get started, run:
echo    npm run mcp
echo.
echo This will open the interactive menu to:
echo  - Setup MCP servers
echo  - Configure Claude Desktop
echo  - Test connections
echo.
pause