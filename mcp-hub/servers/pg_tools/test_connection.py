#!/usr/bin/env python3
"""Quick test to verify database connection works"""

import os
import asyncio
import asyncpg
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def test_connection():
    """Test the PostgreSQL connection"""
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return False
    
    print(f"📡 Connecting to database...")
    print(f"   URL: {database_url[:30]}...")  # Show first part only for security
    
    try:
        # Try to connect
        conn = await asyncpg.connect(database_url)
        
        # Run a simple query
        result = await conn.fetchval("SELECT version()")
        print(f"✅ Connected successfully!")
        print(f"   PostgreSQL version: {result[:50]}...")
        
        # Test listing tables
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            LIMIT 5
        """)
        print(f"   Found {len(tables)} tables (showing up to 5)")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    exit(0 if success else 1)