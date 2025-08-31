# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Date
2025-01-31 (Updated)

## Overview
A centralized hub system for managing multiple Model Context Protocol (MCP) servers with Claude Desktop. This system allows easy installation, configuration, testing, and deployment of various MCP servers through a unified CLI interface.

## Common Development Commands

### Hub Commands
```bash
# Install hub dependencies
npm install

# Launch interactive menu
npm run mcp

# Direct server launch
npm run mcp -- --servername

# Environment variable management
npm run mcp:env

# Quick Windows setup (non-technical users)
START_HERE.bat          # Normal setup
START_HERE.bat --debug  # With detailed output
```

### Testing Commands
```bash
# Test a server directly (bypass hub)
cd servers/servername
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node dist/index.js

# Test Python server with UV
cd servers/pg_tools
uv run -m mcp_server_pg

# Test with environment variables
set DATABASE_URL=postgresql://user:pass@host:5432/db
uv run -m mcp_server_pg
```

### Build Commands
```bash
# TypeScript server
cd servers/everything
npm install
npm run build

# Python server with UV
cd servers/pg_tools
uv venv
uv pip install -e .

# Monorepo server (pnpm)
cd servers/supabase
pnpm install --frozen-lockfile
pnpm build
```

## High-Level Architecture

### Core System Design
The hub operates as a centralized manager that orchestrates multiple MCP servers. It handles the complete lifecycle: discovery → installation → building → configuration → testing → deployment.

**Key architectural principle**: The hub abstracts away platform-specific complexities (especially Windows paths) and provides a unified interface for both technical and non-technical users.

### Server Registration System
All servers are defined in `hub/registry.json`. This acts as the single source of truth for:
- Server metadata (name, description, features)
- Build/runtime commands
- Environment variable requirements
- Platform-specific configurations

The registry drives all hub operations - from menu generation to configuration creation.

### Manager Architecture (`hub/manager.js`)
The `MCPHubManager` class implements a state machine for server lifecycle:
1. **Discovery State**: Reads registry, checks file existence
2. **Installation State**: Manages npm/pnpm/pip dependencies
3. **Build State**: Handles TypeScript/Python compilation
4. **Configuration State**: Generates Claude Desktop configs with platform-specific paths
5. **Test State**: Validates MCP protocol compliance
6. **Deployment State**: Copies configs to Claude Desktop

Critical Windows handling occurs in configuration generation:
- Converts all paths to absolute Windows format
- Adds `cwd` property for module resolution
- Uses full path to node.exe

### Server Type Patterns

#### Node.js/TypeScript Servers
- Must use ES modules (`"type": "module"` in package.json)
- Compile to `dist/` directory
- Entry point typically `dist/index.js` or `dist/transports/stdio.js`
- Use MCP SDK: `@modelcontextprotocol/sdk`

#### Python Servers
- Use UV package manager (hub standard)
- Module-based execution: `python -m module_name`
- Virtual environment in `.venv`
- Use MCP SDK: `mcp[cli]`

#### Monorepo Servers
- Require `monorepo: true` flag in registry
- Need `cwd` set to workspace root for module resolution
- Use pnpm for workspace management
- Entry points deep in package structure

### Windows-Specific Architecture

The hub was specifically hardened for Windows (2025-08-30 updates):

**Path Resolution Strategy**:
```javascript
// Always generate absolute paths
const absolutePath = path.resolve(serverPath, relativePath);
// Convert to Windows format
const windowsPath = absolutePath.replace(/\//g, '\\');
// Add working directory for module resolution
config.cwd = windowsPath;
```

**UV Integration**:
- Installs to `%USERPROFILE%\.local\bin\uv.exe`
- Added to PATH for session in START_HERE.bat
- Used for all Python package management

### MCP Protocol Implementation

Servers must implement the MCP protocol lifecycle:
1. **Initialize**: Accept protocol version, capabilities
2. **List Tools/Resources**: Advertise available features
3. **Execute**: Handle tool calls, resource reads
4. **Shutdown**: Clean termination

The hub validates this by sending an initialize request and checking for proper JSON-RPC response.

### Environment Variable Architecture

Three-layer environment system:
1. **System Environment**: OS-level variables
2. **.env File**: Project-specific variables
3. **Interactive Prompts**: Runtime collection for missing values

Variables are namespaced by server (e.g., `SUPABASE_ACCESS_TOKEN`) to avoid conflicts.

## Critical Implementation Details

### Adding New MCP Servers

1. **Place server in `servers/` directory**
2. **Register in `hub/registry.json`**:
```json
{
  "servers": {
    "your-server": {
      "name": "Display Name",
      "type": "node|python",
      "monorepo": false,
      "packageManager": "npm|pnpm|pip",
      "commands": {
        "install": "npm install",
        "build": "npm run build",
        "start": "node dist/index.js"
      },
      "requiredEnv": {},
      "optionalArgs": ["--read-only"]
    }
  }
}
```
3. **Ensure proper module structure** (ES modules for Node, proper package.json)
4. **Test locally first** before hub integration

### Windows Path Requirements

**Critical**: Claude Desktop on Windows requires:
1. **Absolute paths** - No relative paths work
2. **Backslashes** - Windows path format
3. **Working directory** - Essential for monorepos
4. **Full node.exe path** - `C:\Program Files\nodejs\node.exe`

### Python Server Specifics

**pg_tools Authentication Fix** (2025-08-30):
- Migrated from asyncpg to psycopg3 due to SCRAM authentication bug
- psycopg3 properly handles special characters in passwords
- URL-decoding implemented for encoded passwords

### Batch File Patterns (START_HERE.bat)

**Key fixes applied**:
- Use `REM` not `::` inside parenthesis blocks
- Labels must be outside if blocks
- Use `pushd`/`popd` not `cd` for directory navigation
- Escape parentheses in echo statements with `^`
- Add UV to PATH after installation

### Security Considerations

- Never commit `.env` files (use `.env.example` as template)
- Sensitive environment variables marked with `"sensitive": true`
- Password masking in CLI displays
- Secure credential collection via inquirer

## Debugging MCP Servers

### Common Issues

1. **MODULE_NOT_FOUND**: Missing `cwd` in config (fixed by hub)
2. **EPIPE Error**: Server crash on startup - check env vars
3. **No response**: Wrong start command in registry.json
4. **Build failures**: Check TypeScript config for ES modules

### Debug Tools

```bash
# Enable hub debug output
START_HERE.bat --debug

# Manual protocol test
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node path/to/server.js

# Check generated config
type %APPDATA%\Claude\claude_desktop_config.json
```

## Important File Locations

- **Hub Core**: `hub/manager.js`, `hub/cli.js`
- **Server Registry**: `hub/registry.json`
- **Environment Template**: `.env.example`
- **Windows Setup**: `START_HERE.bat`
- **Python Server**: `servers/pg_tools/src/mcp_server_pg/server.py`
- **Monorepo Example**: `servers/supabase/`
- **Generated Configs**: `configs/` directory

## Platform-Specific Config Paths

- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`