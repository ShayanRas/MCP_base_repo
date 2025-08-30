#!/bin/bash

# ===============================================
# MCP Hub Setup Script for Unix/Mac
# ===============================================

echo ""
echo "========================================"
echo "   MCP Hub - Initial Setup"
echo "   Making MCP Easy for Everyone"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo "[1/5] Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    echo -e "   ${GREEN}✓${NC} Node.js $NODE_VER found"
else
    echo -e "   ${RED}✗${NC} Node.js is not installed!"
    echo "   Please install Node.js 18+ from: https://nodejs.org/"
    echo "   After installing, run this script again."
    exit 1
fi

# Check if Python is installed
echo "[2/5] Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VER=$(python3 --version | cut -d' ' -f2)
    echo -e "   ${GREEN}✓${NC} Python $PYTHON_VER found"
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_VER=$(python --version | cut -d' ' -f2)
    echo -e "   ${GREEN}✓${NC} Python $PYTHON_VER found"
    PYTHON_CMD="python"
else
    echo -e "   ${RED}✗${NC} Python is not installed!"
    echo "   Please install Python 3.10+ from: https://www.python.org/downloads/"
    echo "   After installing, run this script again."
    exit 1
fi

# Check if Git is installed
echo "[3/5] Checking Git..."
if command -v git &> /dev/null; then
    GIT_VER=$(git --version | cut -d' ' -f3)
    echo -e "   ${GREEN}✓${NC} Git $GIT_VER found"
else
    echo -e "   ${RED}✗${NC} Git is not installed!"
    echo "   Please install Git:"
    echo "   - Mac: brew install git"
    echo "   - Linux: sudo apt-get install git (or yum/dnf)"
    echo "   After installing, run this script again."
    exit 1
fi

# Check if npm is available
echo "[4/6] Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VER=$(npm --version)
    echo -e "   ${GREEN}✓${NC} npm $NPM_VER found"
else
    echo -e "   ${RED}✗${NC} npm is not available!"
    echo "   This should come with Node.js. Please reinstall Node.js."
    exit 1
fi

# Check/Install UV package manager
echo "[5/6] Checking UV package manager..."
if command -v uv &> /dev/null; then
    UV_VER=$(uv --version | cut -d' ' -f2)
    echo -e "   ${GREEN}✓${NC} UV $UV_VER found"
elif [ -f "$HOME/.local/bin/uv" ]; then
    UV_VER=$("$HOME/.local/bin/uv" --version | cut -d' ' -f2)
    echo -e "   ${GREEN}✓${NC} UV $UV_VER found (local install)"
else
    echo "   - UV not found, installing..."
    echo "   This may take a minute..."
    curl -LsSf https://astral.sh/uv/install.sh | sh > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} UV package manager installed successfully"
        # Add to PATH for current session
        export PATH="$HOME/.local/bin:$PATH"
    else
        echo -e "   ${RED}✗${NC} Failed to install UV package manager"
        echo "   You can install it manually from: https://github.com/astral-sh/uv"
        echo "   Or continue without Python server support"
    fi
fi

# Check current directory
echo "[6/6] Checking current directory..."
if [ ! -f "hub/cli.js" ]; then
    echo -e "   ${RED}✗${NC} This script must be run from the mcp-hub directory!"
    echo "   Please navigate to the mcp-hub folder and run again."
    exit 1
else
    echo -e "   ${GREEN}✓${NC} Running from correct directory"
fi

echo ""
echo "========================================"
echo "   Installing MCP Hub Components"
echo "========================================"
echo ""

# Run the Node.js setup script
echo "Starting setup process..."
echo ""

# Install hub dependencies first
echo "Installing hub dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo -e "   ${RED}✗${NC} Failed to install hub dependencies"
    exit 1
fi

# Run the main setup
node hub/setup.js
if [ $? -ne 0 ]; then
    echo ""
    echo -e "   ${RED}✗${NC} Setup encountered an error"
    echo "   Please check the messages above and try again"
    exit 1
fi

echo ""
echo "========================================"
echo "   Setup Complete!"
echo "========================================"
echo ""
echo "Your MCP Hub is ready to use!"
echo ""
echo "To get started, run:"
echo -e "   ${CYAN}npm run mcp${NC}"
echo ""
echo "This will open the interactive menu to:"
echo "  • Setup MCP servers"
echo "  • Configure Claude Desktop"
echo "  • Test connections"
echo ""