# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### MCP Hub Management
- **Launch interactive menu**: `npm run mcp` (from mcp-hub directory)
- **Direct server launch**: `npm run mcp -- --<server-name>` (e.g., `--supabase`, `--everything`)
- **Setup servers**: `npm run setup` - Install dependencies and launch menu
- **Test connections**: `npm run test` - Test all server connections
- **Environment management**:
  - `npm run mcp:env` - Show current environment variables
  - `npm run mcp:env:init` - Initialize environment configuration
  - `npm run mcp:env:validate` - Validate environment setup

**New Claude Desktop Management Features**:
- **View Claude Desktop Servers**: Option 7 in menu - Shows all MCP servers currently configured in Claude Desktop
  - Displays server command, arguments, environment variables, and working directory
  - Indicates which servers are hub-managed vs external
- **Manage Claude Desktop Servers**: Option 8 in menu - Remove unwanted servers from Claude Desktop
  - Multi-select interface for batch removal
  - Option to remove all servers at once
  - Automatic backup before modifications
  - Clear feedback on removed and remaining servers

### Individual Server Commands
For servers in `mcp-hub/servers/`:
- **Everything server**: 
  - Build: `npm run build`
  - Run: `npm run start`
  - Watch mode: `npm run watch`
- **Supabase server** (monorepo with pnpm):
  - Install: `pnpm install` (from server root)
  - Build: `pnpm build`
  - Run: `node packages/mcp-server-supabase/dist/transports/stdio.js`
- **pg_tools server** (Python):
  - Install: `uv pip install -e .` or `pip install -e .`
  - Run: `mcp-server-pg`

## Architecture

### Repository Structure
This is an MCP (Model Context Protocol) seed repository designed for building and managing multiple MCP servers through a centralized hub system.

```
MCP_base_repo/
├── mcp-hub/              # Central hub for managing MCP servers
│   ├── hub/              # Core hub logic
│   │   ├── cli.js        # CLI interface for server management
│   │   ├── manager.js    # Server management logic
│   │   └── registry.json # Server configurations and metadata
│   ├── servers/          # Individual MCP server implementations
│   │   ├── everything/   # Demo server showcasing all MCP features
│   │   ├── supabase/     # Supabase PostgreSQL integration
│   │   └── pg_tools/     # PostgreSQL tools server
│   └── configs/          # Generated Claude Desktop configurations
├── Reference/            # Knowledge base and examples
│   ├── Knowledge/        # MCP documentation and guides
│   └── MCP Server Examples/
└── .claude/              # Claude-specific configuration
```

### Key Components

**MCP Hub Manager** (`mcp-hub/hub/manager.js`):
- Handles server lifecycle (install, build, run, test)
- Manages environment variables securely
- Generates Claude Desktop configurations
- Supports both regular and monorepo server structures
- Handles different package managers (npm, pnpm, uv)

**Server Registry** (`mcp-hub/hub/registry.json`):
- Defines server metadata, paths, and commands
- Specifies required/optional environment variables
- Tracks installation and build status
- Configures monorepo-specific settings

**Server Types**:
1. **Node.js servers**: Use TypeScript/JavaScript with MCP SDK
2. **Python servers**: Use Python with mcp package
3. **Monorepo servers**: Require special handling for workspace dependencies

### Adding New Servers
1. Copy server to `mcp-hub/servers/<name>`
2. Register in `hub/registry.json` with appropriate configuration
3. Specify type (node/python), package manager, and commands
4. Define required environment variables
5. Set `monorepo: true` if server uses workspace dependencies

### Configuration Management
- Configs generated in `/configs` directory
- Automatic detection of Claude Desktop config location
- Backup existing configs before updates
- Support for multiple server configurations in single Claude instance

### Monorepo Considerations
For servers with workspace dependencies:
- Must run from workspace root directory
- Use `cwd` in Claude Desktop config instead of absolute path
- Handle module resolution through workspace package manager