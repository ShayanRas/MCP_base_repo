@echo off
setlocal enabledelayedexpansion

:: MCP Hub - Complete Setup and Launch System
:: One-click setup for non-technical users
:: Version 2.0 - Fully Managed Service

title MCP Hub - Setup and Launch

:: Set colors for better UX
color 0A

cls
echo ========================================================
echo          MCP Hub - Model Context Protocol Manager
echo             One-Click Setup and Launch System
echo ========================================================
echo.

:: Create log file
set LOG_FILE=%cd%\mcp_hub_setup.log
echo [%date% %time%] MCP Hub Setup Started > "%LOG_FILE%"

:: Check if running from correct directory
if not exist "hub\manager.js" (
    echo ERROR: Please run this script from the mcp-hub directory
    echo        Current directory: %cd%
    pause
    exit /b 1
)

:: Phase 1: Prerequisites Check
echo [Phase 1/4] Checking Prerequisites...
echo ----------------------------------------

:: Check Node.js
echo Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo    ERROR: Node.js is not installed!
    echo    Please download and install from: https://nodejs.org/
    echo    Recommended version: 18.x or later
    echo [%date% %time%] ERROR: Node.js not found >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo    [OK] Node.js !NODE_VERSION! found
    echo [%date% %time%] Node.js !NODE_VERSION! found >> "%LOG_FILE%"
)

:: Check Python
echo Checking Python...
where python >nul 2>&1
if errorlevel 1 (
    echo    ERROR: Python is not installed!
    echo    Please download and install from: https://python.org/
    echo    Recommended version: 3.10 or later
    echo    IMPORTANT: Check "Add Python to PATH" during installation
    echo [%date% %time%] ERROR: Python not found >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
    echo    [OK] !PYTHON_VERSION! found
    echo [%date% %time%] !PYTHON_VERSION! found >> "%LOG_FILE%"
)

:: Check Git (optional but recommended)
echo Checking Git...
where git >nul 2>&1
if errorlevel 1 (
    echo    [WARN] Git not found (optional, but recommended)
    echo [%date% %time%] WARNING: Git not found >> "%LOG_FILE%"
) else (
    for /f "tokens=*" %%i in ('git --version') do set GIT_VERSION=%%i
    echo    [OK] !GIT_VERSION! found
    echo [%date% %time%] !GIT_VERSION! found >> "%LOG_FILE%"
)

:: Check npm
echo Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo    ERROR: npm is not installed!
    echo    This should come with Node.js. Please reinstall Node.js
    echo [%date% %time%] ERROR: npm not found >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo    [OK] npm !NPM_VERSION! found
    echo [%date% %time%] npm !NPM_VERSION! found >> "%LOG_FILE%"
)

:: Check UV package manager
echo Checking UV package manager...
"%USERPROFILE%\.local\bin\uv.exe" --version >nul 2>&1
if errorlevel 1 (
    echo    UV not found, installing...
    echo [%date% %time%] Installing UV... >> "%LOG_FILE%"
    
    :: Install UV using PowerShell
    powershell -ExecutionPolicy ByPass -Command "& {irm https://astral.sh/uv/install.ps1 | iex}" >nul 2>&1
    
    :: Verify UV installation
    "%USERPROFILE%\.local\bin\uv.exe" --version >nul 2>&1
    if errorlevel 1 (
        echo    ERROR: Failed to install UV package manager
        echo    Please install manually from: https://github.com/astral-sh/uv
        echo [%date% %time%] ERROR: UV installation failed >> "%LOG_FILE%"
        pause
        exit /b 1
    ) else (
        echo    [OK] UV installed successfully
        echo [%date% %time%] UV installed successfully >> "%LOG_FILE%"
    )
) else (
    for /f "tokens=*" %%i in ('"%USERPROFILE%\.local\bin\uv.exe" --version') do set UV_VERSION=%%i
    echo    [OK] UV !UV_VERSION! found
    echo [%date% %time%] UV !UV_VERSION! found >> "%LOG_FILE%"
)

echo.
echo ========================================================

:: Phase 2: Hub Setup
echo [Phase 2/4] Setting up MCP Hub...
echo ----------------------------------------

:: Install hub dependencies
echo Installing hub dependencies...
echo [%date% %time%] Installing hub dependencies... >> "%LOG_FILE%"
call npm install --silent >nul 2>&1
if errorlevel 1 (
    echo    ERROR: Failed to install hub dependencies
    echo    Check your internet connection and try again
    echo [%date% %time%] ERROR: npm install failed >> "%LOG_FILE%"
    pause
    exit /b 1
) else (
    echo    [OK] Hub dependencies installed
    echo [%date% %time%] Hub dependencies installed >> "%LOG_FILE%"
)

:: Check for .env file
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env configuration file...
        copy ".env.example" ".env" >nul
        echo    [OK] Created .env from template
        echo    NOTE: You may need to add your API keys to .env file
        echo [%date% %time%] Created .env from template >> "%LOG_FILE%"
    ) else (
        echo    [INFO] No .env file found. Servers may prompt for credentials.
        echo [%date% %time%] No .env file found >> "%LOG_FILE%"
    )
) else (
    echo    [OK] Configuration file .env exists
)

echo.
echo ========================================================

:: Phase 3: Server Dependencies
echo [Phase 3/4] Installing Server Dependencies...
echo ----------------------------------------
echo This may take a few minutes on first run...
echo.

:: Install pg_tools (Python server)
if exist "servers\pg_tools\pyproject.toml" (
    echo Installing pg_tools (PostgreSQL) server...
    echo [%date% %time%] Installing pg_tools... >> "%LOG_FILE%"
    
    cd servers\pg_tools
    
    :: Remove old .venv if it exists (might be Linux-based)
    if exist ".venv" (
        echo    Cleaning old environment...
        rmdir /s /q ".venv" >nul 2>&1
    )
    
    :: Create new venv and install
    "%USERPROFILE%\.local\bin\uv.exe" venv >nul 2>&1
    "%USERPROFILE%\.local\bin\uv.exe" pip install -e . >nul 2>&1
    
    if errorlevel 1 (
        echo    [WARN] pg_tools installation had issues (may still work)
        echo [%date% %time%] WARNING: pg_tools installation issues >> "%LOG_FILE%"
    ) else (
        echo    [OK] pg_tools server ready
        echo [%date% %time%] pg_tools installed >> "%LOG_FILE%"
    )
    
    cd ..\..
)

:: Install supabase server (Node monorepo)
if exist "servers\supabase\package.json" (
    echo Installing Supabase server...
    echo [%date% %time%] Installing Supabase... >> "%LOG_FILE%"
    
    cd servers\supabase
    
    :: Check if pnpm is available
    where pnpm >nul 2>&1
    if errorlevel 1 (
        :: Use npm if pnpm not available
        call npm install --silent >nul 2>&1
        call npm run build --silent >nul 2>&1
    ) else (
        :: Use pnpm for monorepo
        call pnpm install --frozen-lockfile --silent >nul 2>&1
        call pnpm build --silent >nul 2>&1
    )
    
    if errorlevel 1 (
        echo    [WARN] Supabase installation had issues (may still work)
        echo [%date% %time%] WARNING: Supabase installation issues >> "%LOG_FILE%"
    ) else (
        echo    [OK] Supabase server ready
        echo [%date% %time%] Supabase installed >> "%LOG_FILE%"
    )
    
    cd ..\..
)

:: Install everything server (Node)
if exist "servers\everything\package.json" (
    echo Installing Everything demo server...
    echo [%date% %time%] Installing Everything... >> "%LOG_FILE%"
    
    cd servers\everything
    
    call npm install --silent >nul 2>&1
    call npm run build --silent >nul 2>&1
    
    if errorlevel 1 (
        echo    [WARN] Everything server installation had issues (may still work)
        echo [%date% %time%] WARNING: Everything installation issues >> "%LOG_FILE%"
    ) else (
        echo    [OK] Everything server ready
        echo [%date% %time%] Everything installed >> "%LOG_FILE%"
    )
    
    cd ..\..
)

echo.
echo ========================================================

:: Phase 4: Launch Hub
echo [Phase 4/4] Launching MCP Hub...
echo ----------------------------------------
echo.
echo [%date% %time%] Setup complete, launching hub... >> "%LOG_FILE%"

echo ========================================================
echo               SETUP COMPLETE!
echo ========================================================
echo.
echo The MCP Hub will now launch with the interactive menu.
echo.
echo Quick Guide:
echo   1. Select a server from the menu
echo   2. Choose an action (setup, test, configure)
echo   3. Follow the prompts
echo.
echo For help and documentation, visit:
echo   https://github.com/anthropics/mcp-hub
echo.
echo ========================================================
echo.

:: Give user a moment to read
timeout /t 3 /nobreak >nul

:: Launch the hub
echo [%date% %time%] Launching MCP Hub... >> "%LOG_FILE%"
call npm run mcp

:: If hub exits, show message
echo.
echo ========================================================
echo MCP Hub has exited.
echo.
echo To run again, just double-click START_HERE.bat
echo or run: npm run mcp
echo.
echo [%date% %time%] MCP Hub exited >> "%LOG_FILE%"
pause

endlocal