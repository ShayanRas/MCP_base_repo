#!/bin/bash

# MCP Hub - Complete Setup and Launch System
# One-click setup for non-technical users
# Version 2.1 - With Debug Mode

# Debug mode toggle
DEBUG_MODE=0
if [ "$1" == "--debug" ]; then
    DEBUG_MODE=1
    echo "[DEBUG MODE ENABLED]"
fi

# Help message
if [ "$1" == "--help" ]; then
    echo ""
    echo "Usage: ./START_HERE.sh [options]"
    echo ""
    echo "Options:"
    echo "  --debug    Show detailed output for troubleshooting"
    echo "  --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./START_HERE.sh           Run normal setup"
    echo "  ./START_HERE.sh --debug   Run with detailed output"
    echo ""
    exit 0
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo "========================================================"
echo "         MCP Hub - Model Context Protocol Manager"
echo "            One-Click Setup and Launch System"
if [ $DEBUG_MODE -eq 1 ]; then echo "                     [DEBUG MODE ACTIVE]"; fi
echo "========================================================"
echo ""

# Create log file
LOG_FILE="$PWD/mcp_hub_setup.log"
echo "[$(date)] MCP Hub Setup Started" > "$LOG_FILE"
if [ $DEBUG_MODE -eq 1 ]; then
    echo "[DEBUG] Log file: $LOG_FILE" >> "$LOG_FILE"
fi

# Check if running from correct directory
if [ ! -f "hub/manager.js" ]; then
    echo "ERROR: Please run this script from the mcp-hub directory"
    echo "       Current directory: $PWD"
    echo ""
    echo "       Expected files not found:"
    echo "       - hub/manager.js"
    echo ""
    echo "       Please navigate to the mcp-hub folder and run again."
    echo "[$(date)] ERROR: Wrong directory - $PWD" >> "$LOG_FILE"
    exit 1
fi

if [ $DEBUG_MODE -eq 1 ]; then
    echo "[DEBUG] Running from: $PWD"
    echo "[DEBUG] Current user: $USER"
    echo "[DEBUG] Date/Time: $(date)"
    echo ""
fi

# Phase 1: Prerequisites Check
echo "[Phase 1/4] Checking Prerequisites..."
echo "----------------------------------------"

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   [OK] Node.js $NODE_VERSION found"
    echo "[$(date)] Node.js $NODE_VERSION found" >> "$LOG_FILE"
else
    echo "   ERROR: Node.js is not installed!"
    echo "   Please download and install from: https://nodejs.org/"
    echo "   Recommended version: 18.x or later"
    echo "[$(date)] ERROR: Node.js not found" >> "$LOG_FILE"
    exit 1
fi

# Check Python
echo "Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "   [OK] $PYTHON_VERSION found"
    echo "[$(date)] $PYTHON_VERSION found" >> "$LOG_FILE"
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version)
    echo "   [OK] $PYTHON_VERSION found"
    echo "[$(date)] $PYTHON_VERSION found" >> "$LOG_FILE"
    PYTHON_CMD="python"
else
    echo "   ERROR: Python is not installed!"
    echo "   Please download and install from: https://python.org/"
    echo "   Recommended version: 3.10 or later"
    echo "[$(date)] ERROR: Python not found" >> "$LOG_FILE"
    exit 1
fi

# Check Git (optional but recommended)
echo "Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo "   [OK] $GIT_VERSION found"
    echo "[$(date)] $GIT_VERSION found" >> "$LOG_FILE"
else
    echo "   [WARN] Git not found (optional, but recommended)"
    echo "[$(date)] WARNING: Git not found" >> "$LOG_FILE"
fi

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "   [OK] npm $NPM_VERSION found"
    echo "[$(date)] npm $NPM_VERSION found" >> "$LOG_FILE"
else
    echo "   ERROR: npm is not installed!"
    echo "   This should come with Node.js. Please reinstall Node.js"
    echo "[$(date)] ERROR: npm not found" >> "$LOG_FILE"
    exit 1
fi

# Check UV package manager
echo "Checking UV package manager..."
if command -v uv &> /dev/null; then
    UV_VERSION=$(uv --version | cut -d' ' -f2)
    echo "   [OK] UV $UV_VERSION found"
    echo "[$(date)] UV $UV_VERSION found" >> "$LOG_FILE"
elif [ -f "$HOME/.local/bin/uv" ]; then
    UV_VERSION=$("$HOME/.local/bin/uv" --version | cut -d' ' -f2)
    echo "   [OK] UV $UV_VERSION found (local install)"
    echo "[$(date)] UV $UV_VERSION found (local install)" >> "$LOG_FILE"
else
    echo "   UV not found, installing..."
    echo "[$(date)] Installing UV..." >> "$LOG_FILE"
    
    # Install UV using the official installer
    if [ $DEBUG_MODE -eq 1 ]; then
        echo "[DEBUG] Running UV installer"
        curl -LsSf https://astral.sh/uv/install.sh | sh
    else
        curl -LsSf https://astral.sh/uv/install.sh | sh > /dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        echo "   [OK] UV installed successfully"
        echo "[$(date)] UV installed successfully" >> "$LOG_FILE"
        # Add to PATH for current session
        export PATH="$HOME/.local/bin:$PATH"
    else
        echo "   ERROR: Failed to install UV package manager"
        echo "   Please install manually from: https://github.com/astral-sh/uv"
        echo "[$(date)] ERROR: UV installation failed" >> "$LOG_FILE"
        exit 1
    fi
fi

# Add UV to PATH for this session
export PATH="$HOME/.local/bin:$PATH"
if [ $DEBUG_MODE -eq 1 ]; then echo "[DEBUG] Added UV to PATH for this session"; fi

echo ""
echo "========================================================"

# Phase 2: Hub Setup
echo "[Phase 2/4] Setting up MCP Hub..."
echo "----------------------------------------"

# Install hub dependencies
echo "Installing hub dependencies..."
echo "[$(date)] Installing hub dependencies..." >> "$LOG_FILE"

if [ $DEBUG_MODE -eq 1 ]; then
    echo "[DEBUG] Running: npm install"
    npm install
else
    npm install --silent > /dev/null 2>&1
fi

if [ $? -ne 0 ]; then
    echo "   ERROR: Failed to install hub dependencies"
    echo "   Check your internet connection and try again"
    echo "[$(date)] ERROR: npm install failed" >> "$LOG_FILE"
    if [ $DEBUG_MODE -eq 1 ]; then echo "[DEBUG] Error code: $?"; fi
    exit 1
else
    echo "   [OK] Hub dependencies installed"
    echo "[$(date)] Hub dependencies installed" >> "$LOG_FILE"
fi

# Create necessary directories
echo "Creating required directories..."
mkdir -p logs 2>/dev/null
mkdir -p configs 2>/dev/null
echo "   [OK] Directories ready"

# Check for .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "Creating .env configuration file..."
        cp ".env.example" ".env"
        echo "   [OK] Created .env from template"
        echo "   NOTE: You may need to add your API keys to .env file"
        echo "[$(date)] Created .env from template" >> "$LOG_FILE"
    else
        echo "   [INFO] No .env file found. Servers may prompt for credentials."
        echo "[$(date)] No .env file found" >> "$LOG_FILE"
    fi
else
    echo "   [OK] Configuration file .env exists"
fi

echo ""
echo "========================================================"

# Phase 3: Server Dependencies
echo "[Phase 3/4] Installing Server Dependencies..."
echo "----------------------------------------"
echo "This may take a few minutes on first run..."
echo ""

# Install pg_tools Python server
if [ -f "servers/pg_tools/pyproject.toml" ]; then
    echo "Installing pg_tools (PostgreSQL) server..."
    echo "[$(date)] Installing pg_tools..." >> "$LOG_FILE"
    
    cd "servers/pg_tools" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "   ERROR: Cannot access pg_tools directory"
        echo "[$(date)] ERROR: Cannot access pg_tools directory" >> "$LOG_FILE"
    else
        # Remove old .venv if it exists - might be Windows-based
        if [ -d ".venv" ]; then
            echo "   Cleaning old environment..."
            if [ $DEBUG_MODE -eq 1 ]; then echo "[DEBUG] Removing .venv directory"; fi
            rm -rf ".venv" > /dev/null 2>&1
        fi
        
        # Create new venv and install
        if [ $DEBUG_MODE -eq 1 ]; then
            echo "[DEBUG] Running: uv venv"
            uv venv
            echo "[DEBUG] Running: uv pip install -e ."
            uv pip install -e .
        else
            uv venv > /dev/null 2>&1
            uv pip install -e . > /dev/null 2>&1
        fi
        
        if [ $? -ne 0 ]; then
            echo "   [WARN] pg_tools installation had issues (may still work)"
            echo "[$(date)] WARNING: pg_tools installation issues" >> "$LOG_FILE"
            if [ $DEBUG_MODE -eq 1 ]; then echo "[DEBUG] Error code: $?"; fi
        else
            echo "   [OK] pg_tools server ready"
            echo "[$(date)] pg_tools installed" >> "$LOG_FILE"
        fi
        
        cd ../..
    fi
fi

# Install supabase server - Node monorepo
if [ -f "servers/supabase/package.json" ]; then
    echo "Installing Supabase server..."
    echo "[$(date)] Installing Supabase..." >> "$LOG_FILE"
    
    cd "servers/supabase" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "   ERROR: Cannot access supabase directory"
        echo "[$(date)] ERROR: Cannot access supabase directory" >> "$LOG_FILE"
    else
        # Check if pnpm is available
        if command -v pnpm &> /dev/null; then
            # Use pnpm for monorepo
            if [ $DEBUG_MODE -eq 1 ]; then
                echo "[DEBUG] Using pnpm for monorepo"
                echo "[DEBUG] Running: pnpm install --frozen-lockfile"
                pnpm install --frozen-lockfile
                echo "[DEBUG] Running: pnpm build"
                pnpm build
            else
                pnpm install --frozen-lockfile --silent > /dev/null 2>&1
                pnpm build --silent > /dev/null 2>&1
            fi
        else
            # Use npm if pnpm not available
            if [ $DEBUG_MODE -eq 1 ]; then
                echo "[DEBUG] pnpm not found, using npm"
                echo "[DEBUG] Running: npm install"
                npm install
                echo "[DEBUG] Running: npm run build"
                npm run build
            else
                npm install --silent > /dev/null 2>&1
                npm run build --silent > /dev/null 2>&1
            fi
        fi
        
        if [ $? -ne 0 ]; then
            echo "   [WARN] Supabase installation had issues (may still work)"
            echo "[$(date)] WARNING: Supabase installation issues" >> "$LOG_FILE"
            if [ $DEBUG_MODE -eq 1 ]; then echo "[DEBUG] Error code: $?"; fi
        else
            echo "   [OK] Supabase server ready"
            echo "[$(date)] Supabase installed" >> "$LOG_FILE"
        fi
        
        cd ../..
    fi
fi

# Install everything server - Node
if [ -f "servers/everything/package.json" ]; then
    echo "Installing Everything demo server..."
    echo "[$(date)] Installing Everything..." >> "$LOG_FILE"
    
    cd "servers/everything" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "   ERROR: Cannot access everything directory"
        echo "[$(date)] ERROR: Cannot access everything directory" >> "$LOG_FILE"
    else
        if [ $DEBUG_MODE -eq 1 ]; then
            echo "[DEBUG] Running: npm install"
            npm install
            echo "[DEBUG] Running: npm run build"
            npm run build
        else
            npm install --silent > /dev/null 2>&1
            npm run build --silent > /dev/null 2>&1
        fi
        
        if [ $? -ne 0 ]; then
            echo "   [WARN] Everything server installation had issues (may still work)"
            echo "[$(date)] WARNING: Everything installation issues" >> "$LOG_FILE"
            if [ $DEBUG_MODE -eq 1 ]; then echo "[DEBUG] Error code: $?"; fi
        else
            echo "   [OK] Everything server ready"
            echo "[$(date)] Everything installed" >> "$LOG_FILE"
        fi
        
        cd ../..
    fi
fi

echo ""
echo "========================================================"

# Phase 4: Launch Hub
echo "[Phase 4/4] Launching MCP Hub..."
echo "----------------------------------------"
echo ""
echo "[$(date)] Setup complete, launching hub..." >> "$LOG_FILE"

echo "========================================================"
echo "              SETUP COMPLETE!"
echo "========================================================"
echo ""
echo "The MCP Hub will now launch with the interactive menu."
echo ""
echo "Quick Guide:"
echo "  1. Select a server from the menu"
echo "  2. Choose LOCAL (stdio) or REMOTE (HTTP/SSE) mode"
echo "  3. Follow the prompts for setup and configuration"
echo ""
echo "New Features:"
echo "  • HTTP/SSE Support - Run servers remotely"
echo "  • Live Monitoring - Track running HTTP servers"
echo "  • API Authentication - Secure your servers"
echo ""
echo "========================================================"
echo ""

# Give user a moment to read
sleep 3

# Launch the hub
echo "[$(date)] Launching MCP Hub..." >> "$LOG_FILE"

if [ $DEBUG_MODE -eq 1 ]; then
    echo "[DEBUG] Running: npm run mcp"
    echo "[DEBUG] Log file saved to: $LOG_FILE"
    echo ""
fi

npm run mcp

# If hub exits, show message
echo ""
echo "========================================================"
echo "MCP Hub has exited."
echo ""
echo "To run again, just run ./START_HERE.sh"
echo "or run: npm run mcp"
echo ""
if [ $DEBUG_MODE -eq 1 ]; then
    echo "Debug log saved to: $LOG_FILE"
    echo ""
    echo "If you encountered issues, run with --debug flag:"
    echo "  ./START_HERE.sh --debug"
    echo ""
fi
echo "[$(date)] MCP Hub exited" >> "$LOG_FILE"