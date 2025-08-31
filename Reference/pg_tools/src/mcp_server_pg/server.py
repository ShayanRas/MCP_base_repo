import os
import sys
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

import asyncpg
from dotenv import load_dotenv
from pydantic import AnyUrl

from mcp.server import InitializationOptions
from mcp.server.lowlevel import Server, NotificationOptions
from mcp.server.stdio import stdio_server
import mcp.types as types

# reconfigure UnicodeEncodeError prone default (i.e. windows-1252) to utf-8
if sys.platform == "win32" and os.environ.get('PYTHONIOENCODING') is None:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

load_dotenv()

logger = logging.getLogger('mcp_postgres_server')
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger.info("Starting MCP Postgres Server")


class PostgresDatabase:
    def __init__(self, connection_string: str):
        """Initialize the PostgreSQL database connection."""
        self.connection_string = connection_string
        self.pool = None
        # Don't call _init_database here, it will be called in main()
        
    async def _init_database(self):
        """Initialize the connection pool to the PostgreSQL database."""
        logger.debug("Initializing database connection pool")
        try:
            self.pool = await asyncpg.create_pool(self.connection_string)
            logger.info("Successfully connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL database: {e}")
            raise

    @asynccontextmanager
    async def connection(self):
        """Get a connection from the pool."""
        if not self.pool:
            await self._init_database()
            
        async with self.pool.acquire() as conn:
            yield conn

    async def execute_query(self, query: str, params: List[Any] = None) -> List[Dict[str, Any]]:
        """Execute a SQL query and return results as a list of dictionaries."""
        logger.debug(f"Executing query: {query}")
        try:
            async with self.connection() as conn:
                # Determine if this is a read or write query
                query_lines = query.strip().splitlines()
                first_executable_line = ""
                for line in query_lines:
                    stripped_line = line.strip()
                    if stripped_line and not stripped_line.startswith('--'):
                        first_executable_line = stripped_line
                        break
                
                query_type = ""
                if first_executable_line:
                    # Get the first word of the first non-comment line
                    query_type = first_executable_line.upper().split()[0]
                else: # Query is empty or contains only comments
                    logger.warning("Query is empty or contains only comments.")
                    return [{"error": "Query is empty or contains only comments."}]
                
                logger.debug(f"Detected query type: {query_type}")

                if query_type in ('SELECT', 'SHOW', 'EXPLAIN', 'WITH'): 
                    # Read query
                    rows = await conn.fetch(query, *(params or []))
                    results = [dict(row) for row in rows]
                    logger.debug(f"Read query returned {len(results)} rows")
                    return results
                else:
                    # Write query (INSERT, UPDATE, DELETE, CREATE, etc.)
                    result_status_str = await conn.execute(query, *(params or []))
                    logger.debug(f"Write query result: {result_status_str}")
                    
                    # Improved parsing of the command tag to get affected rows
                    affected_rows = 0
                    if result_status_str: # e.g., "INSERT 0 1", "UPDATE 5", "SELECT 1"
                        parts = result_status_str.split(' ')
                        if parts and parts[-1].isdigit():
                            affected_rows = int(parts[-1])
                        # Fallback for command tags like "CREATE TABLE" which don't have a row count
                        elif not parts[-1].isdigit() and len(parts) > 0:
                             pass # affected_rows remains 0, command is the status itself

                    return [{"affected_rows": affected_rows, "command": result_status_str}]
        except Exception as e:
            logger.error(f"Database error executing query: {e}")
            # Return the error as part of the result instead of raising
            return [{"error": str(e)}]

    async def list_tables(self) -> List[Dict[str, Any]]:
        """List all tables in the database."""
        query = """
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
        """
        return await self.execute_query(query)

    async def describe_table(self, table_name: str) -> List[Dict[str, Any]]:
        """Get the schema information for a specific table."""
        query = """
        SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default
        FROM 
            information_schema.columns
        WHERE 
            table_schema = 'public' AND 
            table_name = $1
        ORDER BY 
            ordinal_position;
        """
        return await self.execute_query(query, [table_name])

    async def get_table_constraints(self, table_name: str) -> List[Dict[str, Any]]:
        """Get constraints for a specific table."""
        query = """
        SELECT
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM
            information_schema.table_constraints tc
        JOIN
            information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        LEFT JOIN
            information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE
            tc.table_schema = 'public' AND
            tc.table_name = $1
        ORDER BY
            tc.constraint_name,
            kcu.column_name;
        """
        return await self.execute_query(query, [table_name])

    async def get_table_indexes(self, table_name: str) -> List[Dict[str, Any]]:
        """Get indexes for a specific table."""
        query = """
        SELECT
            i.relname AS index_name,
            a.attname AS column_name,
            ix.indisunique AS is_unique,
            ix.indisprimary AS is_primary
        FROM
            pg_index ix
        JOIN
            pg_class i ON i.oid = ix.indexrelid
        JOIN
            pg_class t ON t.oid = ix.indrelid
        JOIN
            pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE
            t.relname = $1
        ORDER BY
            i.relname,
            a.attname;
        """
        return await self.execute_query(query, [table_name])

    async def get_database_size(self) -> List[Dict[str, Any]]:
        """Get the size of the current database."""
        query = """
        SELECT
            pg_database.datname AS database_name,
            pg_size_pretty(pg_database_size(pg_database.datname)) AS size
        FROM
            pg_database
        WHERE
            pg_database.datname = current_database();
        """
        return await self.execute_query(query)

    async def get_table_sizes(self) -> List[Dict[str, Any]]:
        """Get sizes of all tables in the database."""
        query = """
        SELECT
            table_name,
            pg_size_pretty(pg_total_relation_size('"' || table_schema || '"."' || table_name || '"')) AS total_size
        FROM
            information_schema.tables
        WHERE
            table_schema = 'public'
        ORDER BY
            pg_total_relation_size('"' || table_schema || '"."' || table_name || '"') DESC;
        """
        return await self.execute_query(query)


async def main():
    logger.info("Starting Postgres MCP Server")
    
    # Get the connection string from environment variables
    connection_string = os.getenv("DATABASE_URL")
    if not connection_string:
        logger.error("DATABASE_URL environment variable not found")
        sys.exit(1)
    
    # Create the database instance
    db = PostgresDatabase(connection_string)
    await db._init_database()  # Ensure the pool is initialized
    
    # Create the MCP server
    server = Server("postgres-manager")
    
    # Register handlers
    logger.debug("Registering handlers")
    
    @server.list_tools()
    async def handle_list_tools() -> List[types.Tool]:
        """List available tools"""
        return [
            types.Tool(
                name="run_sql_query",
                description="Execute any SQL query on the PostgreSQL database (SELECT, INSERT, UPDATE, DELETE, CREATE, etc.)",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "SQL query to execute"},
                        "params": {"type": "array", "description": "Optional parameters for the query", "items": {"type": "string"}},
                    },
                    "required": ["query"],
                },
            ),
            types.Tool(
                name="list_tables",
                description="List all tables in the PostgreSQL database",
                inputSchema={
                    "type": "object",
                    "properties": {},
                },
            ),
            types.Tool(
                name="describe_table",
                description="Get the schema information for a specific table",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "table_name": {"type": "string", "description": "Name of the table to describe"},
                    },
                    "required": ["table_name"],
                },
            ),
            types.Tool(
                name="get_table_constraints",
                description="Get constraints (primary keys, foreign keys, etc.) for a specific table",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "table_name": {"type": "string", "description": "Name of the table to get constraints for"},
                    },
                    "required": ["table_name"],
                },
            ),
            types.Tool(
                name="get_table_indexes",
                description="Get indexes for a specific table",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "table_name": {"type": "string", "description": "Name of the table to get indexes for"},
                    },
                    "required": ["table_name"],
                },
            ),
            types.Tool(
                name="get_database_size",
                description="Get the size of the current database",
                inputSchema={
                    "type": "object",
                    "properties": {},
                },
            ),
            types.Tool(
                name="get_table_sizes",
                description="Get sizes of all tables in the database",
                inputSchema={
                    "type": "object",
                    "properties": {},
                },
            ),
        ]
    
    @server.call_tool()
    async def handle_call_tool(
        name: str, arguments: Dict[str, Any] | None
    ) -> List[types.TextContent | types.ImageContent | types.EmbeddedResource]:
        """Handle tool execution requests"""
        try:
            if name == "run_sql_query":
                if not arguments or "query" not in arguments:
                    raise ValueError("Missing query argument")
                
                params = arguments.get("params", [])
                results = await db.execute_query(arguments["query"], params)
                return [types.TextContent(type="text", text=str(results))]
            
            elif name == "list_tables":
                results = await db.list_tables()
                return [types.TextContent(type="text", text=str(results))]
            
            elif name == "describe_table":
                if not arguments or "table_name" not in arguments:
                    raise ValueError("Missing table_name argument")
                
                results = await db.describe_table(arguments["table_name"])
                return [types.TextContent(type="text", text=str(results))]
            
            elif name == "get_table_constraints":
                if not arguments or "table_name" not in arguments:
                    raise ValueError("Missing table_name argument")
                
                results = await db.get_table_constraints(arguments["table_name"])
                return [types.TextContent(type="text", text=str(results))]
            
            elif name == "get_table_indexes":
                if not arguments or "table_name" not in arguments:
                    raise ValueError("Missing table_name argument")
                
                results = await db.get_table_indexes(arguments["table_name"])
                return [types.TextContent(type="text", text=str(results))]
            
            elif name == "get_database_size":
                results = await db.get_database_size()
                return [types.TextContent(type="text", text=str(results))]
            
            elif name == "get_table_sizes":
                results = await db.get_table_sizes()
                return [types.TextContent(type="text", text=str(results))]
            
            else:
                raise ValueError(f"Unknown tool: {name}")
                
        except Exception as e:
            logger.error(f"Error handling tool call: {e}")
            return [types.TextContent(type="text", text=f"Error: {str(e)}")]
    
    async with stdio_server() as (read_stream, write_stream):
        logger.info("Server running with stdio transport")
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="postgres",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


class ServerWrapper:
    """A wrapper to compat with mcp[cli]"""
    
    async def _run(self):
        await main()
    
    def run(self):
        asyncio.run(self._run())


wrapper = ServerWrapper()

if __name__ == "__main__":
    wrapper.run()
