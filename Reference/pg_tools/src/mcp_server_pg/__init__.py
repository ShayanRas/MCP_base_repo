"""
MCP Server for PostgreSQL database operations.

This module provides an MCP server that exposes PostgreSQL database operations
as tools that can be used by MCP clients.
"""

from .server import wrapper

__all__ = ["wrapper"]
