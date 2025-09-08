#!/bin/bash

# ===============================================
# MCP Hub - Direct Launch from Root
# ===============================================
# 
# If you get "Permission denied", run:
#   chmod +x MCP.sh
# Then try again with:
#   ./MCP.sh
# ===============================================

echo ""
echo "========================================"
echo "   Launching MCP Hub Manager..."
echo "========================================"
echo ""

# Check if mcp-hub directory exists
if [ ! -f "mcp-hub/package.json" ]; then
    echo "Error: mcp-hub directory not found!"
    echo "Please make sure you're in the correct directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "mcp-hub/node_modules" ]; then
    echo "First time setup detected. Installing dependencies..."
    cd mcp-hub
    npm install
    cd ..
    if [ $? -ne 0 ]; then
        echo ""
        echo "Failed to install dependencies."
        echo "Please run ./START_HERE.sh first for initial setup."
        exit 1
    fi
fi

# Navigate to mcp-hub and launch the menu
cd mcp-hub

# Pass any arguments to the CLI (e.g., ./MCP.sh --debug or ./MCP.sh --supabase)
npm run mcp -- "$@"

# Return to root directory
cd ..

echo ""
echo "MCP Hub closed."
echo "To run again: ./MCP.sh"
echo ""