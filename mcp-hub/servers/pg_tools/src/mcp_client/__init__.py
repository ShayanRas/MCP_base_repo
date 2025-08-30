"""
MCP client for communicating with the Postgres MCP server.

This module provides functions for executing SQL queries against the Postgres
database through the MCP server.
"""

from .client import execute_query

__all__ = ["execute_query"]
