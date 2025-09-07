@echo off
setlocal enabledelayedexpansion

:: MCP Hub - Complete Setup and Launch System
:: One-click setup for non-technical users
:: Version 2.1 - With Debug Mode

title MCP Hub - Setup and Launch

:: Debug mode toggle
set DEBUG_MODE=0
if "%1"=="--debug" (
    set DEBUG_MODE=1
    echo [DEBUG MODE ENABLED]
)

:: Help message
if "%1"=="--help" (
    echo.
    echo Usage: START_HERE.bat [options]
    echo.
    echo Options:
    echo   --debug    Show detailed output for troubleshooting
    echo   --help     Show this help message
    echo.
    echo Examples:
    echo   START_HERE.bat           Run normal setup
    echo   START_HERE.bat --debug   Run with detailed output
    echo.
    exit /b 0
)

:: Set colors for better UX
color 0A

cls
echo ========================================================
echo          MCP Hub - Model Context Protocol Manager
echo             One-Click Setup and Launch System
if %DEBUG_MODE%==1 (echo                      [DEBUG MODE ACTIVE])
echo ========================================================
echo.

:: Create log file
set LOG_FILE=%cd%\mcp_hub_setup.log
echo [%date% %time%] MCP Hub Setup Started > "%LOG_FILE%"
if %DEBUG_MODE%==1 (echo [DEBUG] Log file: %LOG_FILE% >> "%LOG_FILE%")

:: Check if running from correct directory
if not exist "hub\manager.js" (
    echo ERROR: Please run this script from the mcp-hub directory
    echo        Current directory: %cd%
    echo.
    echo        Expected files not found:
    echo        - hub\manager.js
    echo.
    echo        Please navigate to the mcp-hub folder and run again.
    echo [%date% %time%] ERROR: Wrong directory - %cd% >> "%LOG_FILE%"
    pause
    exit /b 1
)

if %DEBUG_MODE%==1 (
    echo [DEBUG] Running from: %cd%
    echo [DEBUG] Current user: %USERNAME%
    echo [DEBUG] Date/Time: %date% %time%
    echo.
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
    
    REM Install UV using PowerShell
    powershell -ExecutionPolicy ByPass -Command "& {irm https://astral.sh/uv/install.ps1 | iex}" >nul 2>&1
    
    REM Verify UV installation
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

:: Add UV to PATH for this session
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
if %DEBUG_MODE%==1 (echo [DEBUG] Added UV to PATH for this session)

echo.
echo ========================================================

:: Phase 2: Hub Setup
echo [Phase 2/4] Setting up MCP Hub...
echo ----------------------------------------

:: Install hub dependencies
echo Installing hub dependencies...
echo [%date% %time%] Installing hub dependencies... >> "%LOG_FILE%"

if %DEBUG_MODE%==1 (
    echo [DEBUG] Running: npm install
    call npm install
) else (
    call npm install --silent >nul 2>&1
)

if errorlevel 1 (
    echo    ERROR: Failed to install hub dependencies
    echo    Check your internet connection and try again
    echo [%date% %time%] ERROR: npm install failed >> "%LOG_FILE%"
    if %DEBUG_MODE%==1 (echo [DEBUG] Error code: %errorlevel%)
    pause
    exit /b 1
) else (
    echo    [OK] Hub dependencies installed
    echo [%date% %time%] Hub dependencies installed >> "%LOG_FILE%"
)

:: Create necessary directories
echo Creating required directories...
if not exist "logs" mkdir logs 2>nul
if not exist "configs" mkdir configs 2>nul
echo    [OK] Directories ready

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

:: Install pg_tools Python server
if exist "servers\pg_tools\pyproject.toml" (
    echo Installing pg_tools ^(PostgreSQL^) server...
    echo [%date% %time%] Installing pg_tools... >> "%LOG_FILE%"
    
    pushd "servers\pg_tools" 2>nul
    if errorlevel 1 (
        echo    ERROR: Cannot access pg_tools directory
        echo [%date% %time%] ERROR: Cannot access pg_tools directory >> "%LOG_FILE%"
    ) else (
        REM Remove old .venv if it exists - might be Linux-based
        if exist ".venv" (
            echo    Cleaning old environment...
            if %DEBUG_MODE%==1 (echo [DEBUG] Removing .venv directory)
            rmdir /s /q ".venv" >nul 2>&1
        )
        
        REM Create new venv and install
        if %DEBUG_MODE%==1 (
            echo [DEBUG] Running: uv venv
            uv venv
            echo [DEBUG] Running: uv pip install -e .
            uv pip install -e .
        ) else (
            uv venv >nul 2>&1
            uv pip install -e . >nul 2>&1
        )
        
        if errorlevel 1 (
            echo    [WARN] pg_tools installation had issues ^(may still work^)
            echo [%date% %time%] WARNING: pg_tools installation issues >> "%LOG_FILE%"
            if %DEBUG_MODE%==1 (echo [DEBUG] Error code: %errorlevel%)
        ) else (
            echo    [OK] pg_tools server ready
            echo [%date% %time%] pg_tools installed >> "%LOG_FILE%"
        )
        
        popd
    )
)

:: Install supabase server - Node monorepo
if exist "servers\supabase\package.json" (
    echo Installing Supabase server...
    echo [%date% %time%] Installing Supabase... >> "%LOG_FILE%"
    
    pushd "servers\supabase" 2>nul
    if errorlevel 1 (
        echo    ERROR: Cannot access supabase directory
        echo [%date% %time%] ERROR: Cannot access supabase directory >> "%LOG_FILE%"
    ) else (
        REM Check if pnpm is available
        where pnpm >nul 2>&1
        if errorlevel 1 (
            REM Use npm if pnpm not available
            if %DEBUG_MODE%==1 (
                echo [DEBUG] pnpm not found, using npm
                echo [DEBUG] Running: npm install
                call npm install
                echo [DEBUG] Running: npm run build
                call npm run build
            ) else (
                call npm install --silent >nul 2>&1
                call npm run build --silent >nul 2>&1
            )
        ) else (
            REM Use pnpm for monorepo
            if %DEBUG_MODE%==1 (
                echo [DEBUG] Using pnpm for monorepo
                echo [DEBUG] Running: pnpm install --frozen-lockfile
                call pnpm install --frozen-lockfile
                echo [DEBUG] Running: pnpm build
                call pnpm build
            ) else (
                call pnpm install --frozen-lockfile --silent >nul 2>&1
                call pnpm build --silent >nul 2>&1
            )
        )
        
        if errorlevel 1 (
            echo    [WARN] Supabase installation had issues ^(may still work^)
            echo [%date% %time%] WARNING: Supabase installation issues >> "%LOG_FILE%"
            if %DEBUG_MODE%==1 (echo [DEBUG] Error code: %errorlevel%)
        ) else (
            echo    [OK] Supabase server ready
            echo [%date% %time%] Supabase installed >> "%LOG_FILE%"
        )
        
        popd
    )
)

:: Install everything server - Node
if exist "servers\everything\package.json" (
    echo Installing Everything demo server...
    echo [%date% %time%] Installing Everything... >> "%LOG_FILE%"
    
    pushd "servers\everything" 2>nul
    if errorlevel 1 (
        echo    ERROR: Cannot access everything directory
        echo [%date% %time%] ERROR: Cannot access everything directory >> "%LOG_FILE%"
    ) else (
        if %DEBUG_MODE%==1 (
            echo [DEBUG] Running: npm install
            call npm install
            echo [DEBUG] Running: npm run build
            call npm run build
        ) else (
            call npm install --silent >nul 2>&1
            call npm run build --silent >nul 2>&1
        )
        
        if errorlevel 1 (
            echo    [WARN] Everything server installation had issues ^(may still work^)
            echo [%date% %time%] WARNING: Everything installation issues >> "%LOG_FILE%"
            if %DEBUG_MODE%==1 (echo [DEBUG] Error code: %errorlevel%)
        ) else (
            echo    [OK] Everything server ready
            echo [%date% %time%] Everything installed >> "%LOG_FILE%"
        )
        
        popd
    )
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
echo   2. Choose LOCAL (stdio) or REMOTE (HTTP/SSE) mode
echo   3. Follow the prompts for setup and configuration
echo.
echo New Features:
echo   - HTTP/SSE Support - Run servers remotely
echo   - Live Monitoring - Track running HTTP servers
echo   - API Authentication - Secure your servers
echo.
echo ========================================================
echo.

:: Give user a moment to read
timeout /t 3 /nobreak >nul

:: Launch the hub
echo [%date% %time%] Launching MCP Hub... >> "%LOG_FILE%"

if %DEBUG_MODE%==1 (
    echo [DEBUG] Running: npm run mcp
    echo [DEBUG] Log file saved to: %LOG_FILE%
    echo.
)

call npm run mcp

:: If hub exits, show message
echo.
echo ========================================================
echo MCP Hub has exited.
echo.
echo To run again, just double-click START_HERE.bat
echo or run: npm run mcp
echo.
if %DEBUG_MODE%==1 (
    echo Debug log saved to: %LOG_FILE%
    echo.
    echo If you encountered issues, run with --debug flag:
    echo   START_HERE.bat --debug
    echo.
)
echo [%date% %time%] MCP Hub exited >> "%LOG_FILE%"
pause

endlocal