# PostgreSQL MCP Server

An MCP (Model Context Protocol) server that provides tools for interacting with PostgreSQL databases, specifically designed to work with Supabase-hosted Postgres instances.

## Overview

This MCP server exposes a set of tools that allow AI assistants and other MCP clients to:

- Execute arbitrary SQL queries (SELECT, INSERT, UPDATE, DELETE, CREATE, etc.)
- List tables in the database
- Describe table schemas
- Get table constraints and indexes
- Retrieve database and table size information

## Installation

### Prerequisites

- Python 3.10 or higher
- PostgreSQL database (this server is configured to connect to a Supabase-hosted Postgres instance)
- Environment variables set up with database connection details

### Setup

1. Install the package using uv:

```bash
uv pip install -e .
```

2. Ensure your `.env` file contains the `DATABASE_URL` variable:

```
DATABASE_URL=postgresql://user:password@host:port/database
```

## Usage

### Starting the Server

Start the MCP server:

```bash
mcp-server-pg
```

Or run it directly:

```bash
python -m mcp_server_pg.server
```

### Available Tools

The server exposes the following tools:

#### `run_sql_query`
Execute any SQL query on the PostgreSQL database.

Parameters:
- `query` (string, required): SQL query to execute
- `params` (array, optional): Parameters for the query

#### `list_tables`
List all tables in the PostgreSQL database.

#### `describe_table`
Get the schema information for a specific table.

Parameters:
- `table_name` (string, required): Name of the table to describe

#### `get_table_constraints`
Get constraints (primary keys, foreign keys, etc.) for a specific table.

Parameters:
- `table_name` (string, required): Name of the table to get constraints for

#### `get_table_indexes`
Get indexes for a specific table.

Parameters:
- `table_name` (string, required): Name of the table to get indexes for

#### `get_database_size`
Get the size of the current database.

#### `get_table_sizes`
Get sizes of all tables in the database.

## Error Handling

All errors are caught and returned as part of the response, allowing the agent to handle them gracefully. The response will include an `error` field with a description of what went wrong.

## Security Considerations

This server has full access to execute any SQL query on the connected database. It's recommended to:

1. Use a database user with appropriate permissions
2. Consider implementing additional validation for sensitive operations
3. Monitor database activity when using this server

## Development

### Project Structure

```
pg_tools/
├── src/
│   ├── mcp_server_pg/
│   │   ├── __init__.py
│   │   └── server.py
│   └── __init__.py
├── pyproject.toml
└── README.md
```

### Adding New Tools

To add a new tool:

1. Add a new method to the `PostgresDatabase` class in `server.py`
2. Register the tool in the `handle_list_tools` function
3. Add a handler for the tool in the `handle_call_tool` function
