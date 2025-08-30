# 🚀 MCP Hub - Multi-Server Manager

A centralized hub for managing multiple Model Context Protocol (MCP) servers with Claude Desktop.

## Features

- 📦 **Multiple Server Management** - Manage all your MCP servers from one place
- 🔧 **Automatic Setup** - Install dependencies and build servers automatically
- 🎯 **Quick Launch** - Direct command to setup and run specific servers
- 🎨 **Interactive Menu** - User-friendly CLI interface
- 🔑 **Secure Env Management** - Handle sensitive environment variables safely
- 📋 **Config Generation** - Generate and manage Claude Desktop configurations
- ✅ **Health Checks** - Test server connections before deployment

## Installation

```bash
cd mcp-hub
npm install
```

## Usage

### Interactive Mode
Launch the interactive menu to manage all servers:

```bash
npm run mcp
```

This will show you a menu with options to:
- 🚀 Quick Launch servers
- 📋 List all available servers
- 📦 Setup (install & build) servers
- 🔧 Generate configurations
- ✅ Test connections
- 📁 Copy configs to Claude Desktop

### Direct Mode
Launch a specific server directly:

```bash
# Launch Supabase MCP server
npm run mcp -- --supabase

# Launch Everything Example server
npm run mcp -- --everything
```

This will:
1. Check if server is installed/built
2. Install dependencies if needed
3. Build the server if needed
4. Prompt for required environment variables
5. Test the connection
6. Generate Claude Desktop config
7. Optionally copy to Claude Desktop

## Available Servers

### 1. Supabase MCP Server
Connect to Supabase PostgreSQL databases with full CRUD operations.

**Features:**
- SQL execution
- Schema introspection
- Migrations management
- TypeScript type generation
- Edge Functions management

**Required Environment:**
- `SUPABASE_ACCESS_TOKEN` - Personal access token
- `SUPABASE_PROJECT_REF` - Project reference ID

### 2. Everything Example Server
MCP demo server showcasing all protocol features.

**Features:**
- Tools demonstration
- Resources with pagination
- Prompts with arguments
- Progress notifications
- Multi-modal content

## Adding New Servers

1. **Add server to `/servers` directory**
   ```bash
   cp -r your-mcp-server mcp-hub/servers/your-server
   ```

2. **Register in `hub/registry.json`**
   ```json
   {
     "servers": {
       "your-server": {
         "name": "Your Server Name",
         "description": "Description",
         "path": "./servers/your-server",
         "commands": {
           "install": "npm install",
           "build": "npm run build",
           "start": "node dist/index.js"
         },
         "requiredEnv": {
           "API_KEY": {
             "description": "Your API key",
             "sensitive": true
           }
         }
       }
     }
   }
   ```

3. **Use the server**
   ```bash
   npm run mcp -- --your-server
   ```

## Configuration Files

Generated configurations are stored in `/configs` directory and can be:
- Viewed and edited manually
- Copied to Claude Desktop automatically
- Backed up before updates

## Claude Desktop Integration

The hub automatically detects your Claude Desktop installation:
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

After copying config, restart Claude Desktop to apply changes.

## Troubleshooting

### Server won't start
- Check dependencies are installed: `npm run mcp` → Setup Server
- Verify environment variables are correct
- Check server logs in console output

### Config not working in Claude
- Ensure Claude Desktop is completely restarted
- Check config path is correct for your OS
- Verify server path in config is absolute

### Build failures
- Check Node.js version (requires 18+)
- Try cleaning and rebuilding
- Check package manager (npm/pnpm) is correct

## Development

To add features to the hub itself:
1. Core logic: `hub/manager.js`
2. CLI interface: `hub/cli.js`
3. Server registry: `hub/registry.json`

## License

MIT