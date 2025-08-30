#!/bin/bash

# ===============================================
# MCP Base Repository - Quick Start for Unix/Mac
# ===============================================

echo ""
echo "========================================"
echo "   Welcome to MCP Base Repository!"
echo "   Let's get you started..."
echo "========================================"
echo ""

# Check if mcp-hub directory exists
if [ ! -f "mcp-hub/start_here.sh" ]; then
    echo "Error: mcp-hub directory not found!"
    echo "Please make sure you're in the correct directory."
    exit 1
fi

# Navigate to mcp-hub and run the setup
cd mcp-hub
bash start_here.sh
cd ..

echo ""
echo "Ready to use MCP Hub!"
echo "Run 'cd mcp-hub && npm run mcp' to start the interactive menu."
echo ""