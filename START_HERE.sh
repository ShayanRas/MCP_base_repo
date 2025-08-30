#!/bin/bash

# ===============================================
# MCP Base Repository - Quick Start for Unix/Mac
# ===============================================
# 
# If you get "Permission denied", run:
#   chmod +x START_HERE.sh
# Then try again with:
#   ./START_HERE.sh
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
SETUP_RESULT=$?
cd ..

if [ $SETUP_RESULT -ne 0 ]; then
    echo ""
    echo "Setup failed. Please check the errors above."
    exit $SETUP_RESULT
fi

echo ""
echo "Ready to use MCP Hub!"
echo "Run 'cd mcp-hub && npm run mcp' to start the interactive menu."
echo ""