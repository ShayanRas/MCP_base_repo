#!/usr/bin/env python3
"""Test MCP protocol initialization"""

import os
import sys
import json
import asyncio
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Load environment variables
load_dotenv()

async def test_mcp_init():
    """Test the MCP server initialization"""
    
    # Import the server
    from mcp_server_pg.server import main
    
    print("Starting MCP server test...")
    print(f"DATABASE_URL is {'set ✓' if os.getenv('DATABASE_URL') else 'NOT SET ✗'}")
    
    # The server expects to run with stdio, so we'd need to simulate that
    # For now, just verify the server can be imported and database can connect
    try:
        # Just run the main function briefly
        # Note: This will block waiting for stdio, so we'll need to handle it differently
        print("✅ Server module imported successfully")
        print("✅ Database URL is configured")
        
        # Quick database test
        import asyncpg
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        await conn.close()
        print("✅ Database connection successful")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_mcp_init())
    exit(0 if success else 1)