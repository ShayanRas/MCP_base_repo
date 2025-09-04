# Supabase MCP Server - Local Setup Guide

## Prerequisites

1. **Supabase Project**: You need an existing Supabase project
2. **Node.js**: Version 18+ installed
3. **Claude Desktop**: Installed and configured

## Configuration Steps

### 1. Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy your:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Project Reference ID** (e.g., `xxxxx`)
   - **Service Role Key** (for full access) or **Anon Key** (for limited access)

### 2. Create Personal Access Token

1. Go to [Supabase Account Settings](https://supabase.com/dashboard/account/tokens)
2. Click "Generate New Token"
3. Name it something like "MCP Server Access"
4. Copy the token immediately (you won't see it again!)

### 3. Configure Claude Desktop

Add this configuration to your Claude Desktop settings:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": [
        "C:\\Users\\Shayan\\Github_projects\\MCP_base_repo\\supabase-mcp-server\\packages\\mcp-server-supabase\\dist\\transports\\stdio.js"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_PERSONAL_ACCESS_TOKEN",
        "SUPABASE_PROJECT_REF": "YOUR_PROJECT_REF"
      }
    }
  }
}
```

Replace:
- `YOUR_PERSONAL_ACCESS_TOKEN` with your personal access token
- `YOUR_PROJECT_REF` with your project reference ID
- Adjust the path if you cloned to a different location

### 4. Optional: Read-Only Mode

For safety, you can enable read-only mode by adding `--read-only` to the args:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": [
        "C:\\Users\\Shayan\\Github_projects\\MCP_base_repo\\supabase-mcp-server\\packages\\mcp-server-supabase\\dist\\transports\\stdio.js",
        "--read-only"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_PERSONAL_ACCESS_TOKEN",
        "SUPABASE_PROJECT_REF": "YOUR_PROJECT_REF"
      }
    }
  }
}
```

### 5. Restart Claude Desktop

After saving the configuration:
1. Completely quit Claude Desktop
2. Start Claude Desktop again
3. The MCP server should now be connected

## Available Tools

Once connected, you can use these tools in Claude:

### Database Operations
- `list_tables` - List all tables in your database
- `list_extensions` - List installed PostgreSQL extensions
- `execute_sql` - Execute SQL queries (read/write based on mode)
- `apply_migration` - Apply database migrations

### Development Tools
- `get_typescript_types` - Generate TypeScript types from your schema
- `list_edge_functions` - List your Edge Functions
- `search_docs` - Search Supabase documentation

### Example Usage

In Claude, you can now:
```
"List all tables in my Supabase database"
"Execute SQL: SELECT * FROM users LIMIT 10"
"Show me the schema of the posts table"
"Create a new table for storing comments"
```

## Troubleshooting

### Server Not Connecting
1. Check that the path in config.json is correct
2. Verify your access token is valid
3. Check Claude Desktop logs for errors

### Permission Errors
- Make sure your access token has the necessary permissions
- Use read-only mode if you only need to query data

### Build Issues
If you need to rebuild:
```bash
cd supabase-mcp-server
pnpm install
pnpm build
```

## Security Best Practices

1. **Never use production databases** for testing
2. **Enable read-only mode** when possible
3. **Keep your access token secure** - never commit it to git
4. **Use project-specific tokens** with limited scope
5. **Regularly rotate your access tokens**

## Direct Database Connection (Alternative)

If you prefer a direct PostgreSQL connection instead of using Supabase API:

1. Get your database connection string from Supabase Dashboard → Settings → Database
2. Use the PostgreSQL MCP server instead (we can set this up separately)

This would give you more direct control but less Supabase-specific features.