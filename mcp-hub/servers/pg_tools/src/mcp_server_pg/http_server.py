#!/usr/bin/env python3

import os
import sys
import asyncio
import logging
import json
import uuid
from typing import Dict, Any, Optional
from urllib.parse import urlparse
import argparse

from aiohttp import web
from aiohttp_sse import sse_response
import aiohttp_cors
from dotenv import load_dotenv

from mcp.server import InitializationOptions
from mcp.server.lowlevel import Server
import mcp.types as types

# Import the PostgresDatabase class from the main server
from .server import PostgresDatabase

# Fix Windows compatibility for asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    # Reconfigure encoding for Windows
    if os.environ.get('PYTHONIOENCODING') is None:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

load_dotenv()

logger = logging.getLogger('mcp_postgres_http_server')
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class PostgresHTTPServer:
    def __init__(self, connection_string: str, port: int = 3003):
        self.connection_string = connection_string
        self.port = port
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.app = web.Application()
        self.setup_routes()
        self.setup_cors()
        
    def setup_cors(self):
        """Setup CORS for the application"""
        cors = aiohttp_cors.setup(self.app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Configure CORS on all routes
        for route in list(self.app.router.routes()):
            cors.add(route)
    
    def setup_routes(self):
        """Setup HTTP routes"""
        self.app.router.add_get('/mcp/sse', self.handle_sse)
        self.app.router.add_post('/mcp/message', self.handle_message)
        self.app.router.add_post('/mcp', self.handle_http_post)
        self.app.router.add_get('/mcp', self.handle_http_get)
        self.app.router.add_delete('/mcp', self.handle_http_delete)
        self.app.router.add_get('/health', self.handle_health)
    
    async def handle_health(self, request: web.Request) -> web.Response:
        """Health check endpoint"""
        return web.json_response({
            "status": "healthy",
            "service": "pg_tools MCP HTTP Server",
            "sessions": len(self.sessions)
        })
    
    async def handle_sse(self, request: web.Request) -> web.Response:
        """Handle SSE connections"""
        session_id = request.query.get('sessionId')
        
        if not session_id:
            # Create new session
            session_id = str(uuid.uuid4())
            db = PostgresDatabase(self.connection_string)
            await db._init_database()
            
            server = Server("pg_tools")
            
            # Initialize server with tools
            @server.list_tools()
            async def list_tools() -> list[types.Tool]:
                return await self._create_tools()
            
            # Store session
            self.sessions[session_id] = {
                'server': server,
                'db': db,
                'transport': None
            }
            
            logger.info(f"New SSE session created: {session_id}")
        
        # Send SSE response
        async with sse_response(request) as resp:
            await resp.prepare(request)
            await resp.send_data(json.dumps({
                "sessionId": session_id,
                "status": "connected"
            }))
            
            # Keep connection alive
            try:
                while True:
                    await asyncio.sleep(30)
                    await resp.send_data(json.dumps({"ping": "pong"}))
            except Exception as e:
                logger.error(f"SSE connection error: {e}")
            finally:
                # Clean up session if connection closes
                if session_id in self.sessions:
                    session = self.sessions[session_id]
                    if session['db']:
                        await session['db'].cleanup()
                    del self.sessions[session_id]
                    logger.info(f"Session {session_id} closed")
        
        return resp
    
    async def handle_message(self, request: web.Request) -> web.Response:
        """Handle JSON-RPC messages"""
        session_id = request.query.get('sessionId')
        
        if not session_id or session_id not in self.sessions:
            return web.json_response({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32000,
                    "message": "Invalid or missing session ID"
                }
            }, status=400)
        
        try:
            data = await request.json()
            session = self.sessions[session_id]
            server = session['server']
            
            # Process the JSON-RPC request
            result = await self._process_jsonrpc(server, session['db'], data)
            
            return web.json_response(result)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return web.json_response({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }, status=500)
    
    async def handle_http_post(self, request: web.Request) -> web.Response:
        """Handle StreamableHTTP POST requests"""
        session_id = request.headers.get('mcp-session-id')
        
        if not session_id:
            # Initialize new session
            session_id = str(uuid.uuid4())
            db = PostgresDatabase(self.connection_string)
            await db._init_database()
            
            server = Server("pg_tools")
            
            # Store session
            self.sessions[session_id] = {
                'server': server,
                'db': db,
                'transport': 'http'
            }
            
            logger.info(f"New HTTP session created: {session_id}")
            
            # Return initialization response
            return web.json_response({
                "jsonrpc": "2.0",
                "result": {
                    "sessionId": session_id,
                    "capabilities": {
                        "tools": True,
                        "resources": False,
                        "prompts": False
                    }
                },
                "id": 1
            }, headers={"mcp-session-id": session_id})
        
        # Handle regular message
        try:
            data = await request.json()
            session = self.sessions.get(session_id)
            
            if not session:
                return web.json_response({
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32000,
                        "message": "Session not found"
                    }
                }, status=400)
            
            result = await self._process_jsonrpc(session['server'], session['db'], data)
            return web.json_response(result)
            
        except Exception as e:
            logger.error(f"Error in HTTP POST: {e}")
            return web.json_response({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }, status=500)
    
    async def handle_http_get(self, request: web.Request) -> web.Response:
        """Handle StreamableHTTP GET requests for SSE"""
        session_id = request.headers.get('mcp-session-id')
        
        if not session_id or session_id not in self.sessions:
            return web.json_response({
                "jsonrpc": "2.0",
                "error": {
                    "code": -32000,
                    "message": "Invalid session ID"
                }
            }, status=400)
        
        # Return SSE stream
        return await self.handle_sse(request)
    
    async def handle_http_delete(self, request: web.Request) -> web.Response:
        """Handle session termination"""
        session_id = request.headers.get('mcp-session-id')
        
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            if session['db']:
                await session['db'].cleanup()
            del self.sessions[session_id]
            logger.info(f"Session {session_id} terminated")
        
        return web.json_response({"status": "terminated"})
    
    async def _process_jsonrpc(self, server: Server, db: PostgresDatabase, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process JSON-RPC request and return response"""
        method = request.get('method')
        params = request.get('params', {})
        request_id = request.get('id')
        
        try:
            if method == 'tools/list':
                tools = await self._create_tools()
                return {
                    "jsonrpc": "2.0",
                    "result": {"tools": [tool.model_dump() for tool in tools]},
                    "id": request_id
                }
            elif method == 'tools/call':
                tool_name = params.get('name')
                tool_args = params.get('arguments', {})
                result = await self._call_tool(db, tool_name, tool_args)
                return {
                    "jsonrpc": "2.0",
                    "result": result,
                    "id": request_id
                }
            else:
                return {
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    },
                    "id": request_id
                }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "error": {
                    "code": -32603,
                    "message": str(e)
                },
                "id": request_id
            }
    
    async def _create_tools(self) -> list[types.Tool]:
        """Create the list of available tools"""
        return [
            types.Tool(
                name="execute_query",
                description="Execute a read-only SQL query",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The SQL query to execute"
                        }
                    },
                    "required": ["query"]
                }
            ),
            types.Tool(
                name="execute_write",
                description="Execute a write SQL statement",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "statement": {
                            "type": "string",
                            "description": "The SQL statement to execute"
                        }
                    },
                    "required": ["statement"]
                }
            ),
            types.Tool(
                name="list_tables",
                description="List all tables in the database",
                inputSchema={
                    "type": "object",
                    "properties": {}
                }
            ),
            types.Tool(
                name="describe_table",
                description="Get the schema of a specific table",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "table_name": {
                            "type": "string",
                            "description": "The name of the table"
                        }
                    },
                    "required": ["table_name"]
                }
            )
        ]
    
    async def _call_tool(self, db: PostgresDatabase, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool and return the result"""
        if tool_name == "execute_query":
            result = await db.execute_query(arguments['query'])
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
        elif tool_name == "execute_write":
            result = await db.execute_write(arguments['statement'])
            return {"content": [{"type": "text", "text": result}]}
        elif tool_name == "list_tables":
            result = await db.list_tables()
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
        elif tool_name == "describe_table":
            result = await db.describe_table(arguments['table_name'])
            return {"content": [{"type": "text", "text": json.dumps(result, indent=2)}]}
        else:
            raise ValueError(f"Unknown tool: {tool_name}")
    
    async def start(self):
        """Start the HTTP server"""
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', self.port)
        await site.start()
        logger.info(f"PostgreSQL MCP HTTP Server running on http://localhost:{self.port}")
        logger.info(f"Connect via: http://localhost:{self.port}/mcp")

async def main():
    parser = argparse.ArgumentParser(description='PostgreSQL MCP HTTP Server')
    parser.add_argument('--port', type=int, default=3003, help='Port to run the server on')
    parser.add_argument('--database-url', type=str, help='PostgreSQL connection string')
    args = parser.parse_args()
    
    # Get database URL from args or environment
    database_url = args.database_url or os.getenv('DATABASE_URL')
    
    if not database_url:
        logger.error("Please provide DATABASE_URL environment variable or --database-url argument")
        sys.exit(1)
    
    # Create and start the server
    server = PostgresHTTPServer(database_url, args.port)
    await server.start()
    
    # Keep the server running
    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        logger.info("Server shutting down...")
        # Clean up all sessions
        for session_id, session in server.sessions.items():
            if session['db']:
                await session['db'].cleanup()
        logger.info("Server stopped")

def run():
    """Entry point for the HTTP server"""
    asyncio.run(main())

if __name__ == "__main__":
    run()