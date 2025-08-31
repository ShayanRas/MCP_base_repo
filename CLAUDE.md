# MCP Hub - Multi-Server Management System

## Date
2025-08-30 (Updated)

## Overview
A centralized hub system for managing multiple Model Context Protocol (MCP) servers with Claude Desktop. This system allows easy installation, configuration, testing, and deployment of various MCP servers through a unified CLI interface.

## Core MCP Knowledge

### What is MCP (Model Context Protocol)?

MCP is a standardized protocol that enables Large Language Models (LLMs) like Claude to securely interact with external data sources and tools. It provides a universal, open standard for connecting AI assistants to the systems where data lives.

### Key MCP Concepts

#### 1. **The Three Primitives**

**Tools** - Actions the server can perform
- Executable functions with side effects
- Take structured input, return structured output
- Examples: `execute_sql`, `create_file`, `send_email`
- Defined with JSON Schema for validation

**Resources** - Data the server exposes
- Read-only data access points
- URI-based identification
- Support for different MIME types
- Can be subscribed to for updates
- Examples: file contents, database schemas, API responses

**Prompts** - Reusable interaction templates
- Pre-configured conversation starters
- Can include arguments for customization
- Useful for common workflows
- Examples: debug prompts, analysis templates

#### 2. **Protocol Architecture**

```
Client (Claude) <-> MCP Protocol <-> Server (Your Code)
                    ↓
            JSON-RPC 2.0 over stdio/SSE
```

- **Transport Layer**: stdio (standard), SSE, or HTTP
- **Message Format**: JSON-RPC 2.0
- **Lifecycle**: Initialize → Capability Discovery → Request/Response → Shutdown

#### 3. **Server Lifecycle**

1. **Initialization**
   ```json
   {
     "jsonrpc": "2.0",
     "method": "initialize",
     "params": {
       "protocolVersion": "2024-11-05",
       "capabilities": {},
       "clientInfo": { "name": "Claude", "version": "1.0" }
     }
   }
   ```

2. **Capability Exchange**
   - Server advertises what it supports
   - Client confirms its capabilities
   - Negotiation of features

3. **Operation Phase**
   - Tool invocations
   - Resource reads
   - Prompt requests
   - Notifications

4. **Shutdown**
   - Graceful cleanup
   - Resource deallocation

#### 4. **Security Model**

- **User Consent**: Every action requires approval
- **Capability-Based**: Servers only expose declared capabilities
- **Sandboxed Execution**: Servers run in isolated processes
- **No Ambient Authority**: No automatic access to user resources

### Building MCP Servers

#### Essential Components

1. **Server Class** (using MCP SDK)
   ```javascript
   import { Server } from "@modelcontextprotocol/sdk/server/index.js";
   
   const server = new Server({
     name: "my-server",
     version: "1.0.0"
   }, {
     capabilities: {
       tools: {},
       resources: {},
       prompts: {}
     }
   });
   ```

2. **Tool Implementation**
   ```javascript
   server.setRequestHandler(CallToolRequestSchema, async (request) => {
     const { name, arguments: args } = request.params;
     
     if (name === "my_tool") {
       // Validate input
       const validated = MySchema.parse(args);
       
       // Execute action
       const result = await doSomething(validated);
       
       // Return structured response
       return {
         content: [{ type: "text", text: result }]
       };
     }
   });
   ```

3. **Resource Handler**
   ```javascript
   server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
     const { uri } = request.params;
     
     if (uri.startsWith("myscheme://")) {
       const data = await fetchData(uri);
       return {
         contents: [{
           uri,
           mimeType: "application/json",
           text: JSON.stringify(data)
         }]
       };
     }
   });
   ```

4. **Transport Setup**
   ```javascript
   import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
   
   const transport = new StdioServerTransport();
   await server.connect(transport);
   ```

#### Best Practices for MCP Servers

1. **Input Validation**
   - Always use Zod or similar for schema validation
   - Never trust user input
   - Provide clear error messages

2. **Error Handling**
   ```javascript
   try {
     const result = await riskyOperation();
     return { content: [{ type: "text", text: result }] };
   } catch (error) {
     return {
       content: [{
         type: "text",
         text: `Error: ${error.message}`
       }],
       isError: true
     };
   }
   ```

3. **Resource Design**
   - Use meaningful URI schemes
   - Implement pagination for large datasets
   - Support subscriptions for real-time updates

4. **Security Considerations**
   - Sanitize all inputs
   - Use environment variables for secrets
   - Implement rate limiting
   - Log security-relevant events

### MCP SDK Key Features

#### TypeScript/JavaScript SDK
```bash
npm install @modelcontextprotocol/sdk
```

Key classes:
- `Server` - Main server class
- `StdioServerTransport` - Standard I/O transport
- Request/Response schemas for type safety
- Built-in error handling

#### Python SDK
```bash
pip install mcp
```

Key modules:
- `mcp.server` - Server implementation
- `mcp.server.stdio` - stdio transport
- Type hints for all operations

## Architecture

### Directory Structure
```
mcp-hub/
├── servers/                    # Individual MCP servers
│   ├── supabase/              # Supabase PostgreSQL MCP
│   ├── everything/            # Demo MCP with all features
│   └── [your-server]/         # Add new servers here
├── hub/                        # Hub management core
│   ├── registry.json          # Server definitions & metadata
│   ├── manager.js             # Core server management logic
│   └── cli.js                 # CLI interface entry point
├── configs/                    # Generated configurations
└── package.json               # Hub package with npm scripts
```

## How to Use MCP Hub

### Installation
```bash
cd mcp-hub
npm install
```

### Running the Hub

#### Interactive Mode
Launch the interactive menu system:
```bash
npm run mcp
```

This provides options to:
- 🚀 **Quick Launch** - Full setup and configuration
- 📋 **List Servers** - View all available servers and status
- 📦 **Setup Server** - Install dependencies and build
- 🔧 **Generate Config** - Create Claude Desktop configuration
- ✅ **Test Connection** - Verify server responds to MCP protocol
- 📁 **Copy Config** - Deploy to Claude Desktop

#### Direct Mode
Launch a specific server directly:
```bash
# For Supabase server
npm run mcp -- --supabase

# For Everything demo server
npm run mcp -- --everything

# For any custom server you add
npm run mcp -- --yourserver
```

## Adding New MCP Servers

### Step 1: Add Server Files
Place your MCP server in the `servers` directory:
```bash
cp -r your-mcp-server mcp-hub/servers/your-server-name
```

### Step 2: Register in registry.json
Edit `hub/registry.json` to add your server definition:

```json
{
  "servers": {
    "your-server-name": {
      "name": "Your Server Display Name",
      "description": "What your server does",
      "path": "./servers/your-server-name",
      "type": "node",
      "monorepo": false,
      "packageManager": "npm",
      "commands": {
        "install": "npm install",
        "build": "npm run build",
        "start": "node dist/index.js",
        "test": "npm test"
      },
      "requiredEnv": {
        "API_KEY": {
          "description": "Your API key",
          "sensitive": true,
          "required": true
        },
        "BASE_URL": {
          "description": "API base URL",
          "sensitive": false,
          "required": false
        }
      },
      "optionalArgs": ["--verbose", "--read-only"],
      "features": [
        "Feature 1",
        "Feature 2"
      ],
      "status": "not-checked",
      "installed": false,
      "built": false
    }
  }
}
```

### Step 3: Use Your Server
```bash
npm run mcp -- --your-server-name
```

## Creating a New MCP Server from Scratch

### Basic Server Template

1. **Create package.json**
```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

2. **Create tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

3. **Create src/index.ts**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Define your tool schema
const MyToolSchema = z.object({
  input: z.string().describe("Input for the tool"),
});

// Create server
const server = new Server(
  {
    name: "my-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "my_tool",
        description: "Does something useful",
        inputSchema: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "Input for the tool",
            },
          },
          required: ["input"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "my_tool") {
    const validated = MyToolSchema.parse(args);
    
    // Your tool logic here
    const result = `Processed: ${validated.input}`;
    
    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

## Debugging MCP Servers

### Common Issues and Solutions

#### 1. TypeScript Build Issues
**Problem**: Server fails to build with module errors
**Solution**: Check `tsconfig.json` for correct module settings:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",  // For ES modules
    "moduleResolution": "node",
    "outDir": "./dist"
  }
}
```

#### 2. Server Not Responding
**Problem**: "Server did not respond within 5 seconds"
**Solutions**:
- Verify the start command path is correct in registry.json
- Check if server requires environment variables
- Test server manually: `node path/to/server.js`
- Look for console errors during startup

#### 3. Module Type Mismatch
**Problem**: "exports is not defined in ES module scope"
**Solution**: Ensure package.json `"type": "module"` matches TypeScript output

#### 4. Missing Dependencies
**Problem**: Build fails with missing packages
**Solution**: 
- Remove `prepare` scripts that run during install
- Ensure devDependencies are installed before build

### Manual Testing
Test a server directly without the hub:
```bash
cd mcp-hub/servers/your-server
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node dist/index.js
```

### Debug Output
Add debug logging to your server:
```javascript
server.onerror = (error) => {
  console.error("[MCP Error]", error);
};

// Log all requests
server.onrequest = (request) => {
  console.error("[MCP Request]", request.method);
};
```

## What Changed on 2025-08-30

### Problem Solved
The Supabase MCP server wasn't working with Claude Desktop on Windows due to:
1. Relative paths in the generated configuration
2. Missing working directory (`cwd`) property
3. Windows path format issues (forward slashes instead of backslashes)

### Solution Implemented
Updated `hub/manager.js` to:
1. **Generate absolute paths** for all file references
2. **Add `cwd` property** to all server configs for better reliability
3. **Convert to Windows path format** with backslashes when on Windows
4. **Use full path to node.exe** on Windows (`C:\Program Files\nodejs\node.exe`)
5. **Handle monorepo installations** with proper pnpm commands

### Key Code Changes
The `generateConfig` method now:
```javascript
// Detect Windows and use absolute paths
const isWindows = process.platform === 'win32';
if (isWindows && command === 'node') {
  command = 'C:\\Program Files\\nodejs\\node.exe';
}

// Always use absolute paths
if (args[0] && !path.isAbsolute(args[0])) {
  args[0] = path.resolve(serverPath, args[0]);
}

// Convert to Windows format
if (isWindows) {
  args[0] = args[0].replace(/\//g, '\\');
}

// Always add cwd for reliability
serverConfig.cwd = isWindows ? serverPath.replace(/\//g, '\\') : serverPath;
```

## How the Hub Works

### Core Components

#### 1. Manager (hub/manager.js)
- **Server Registry**: Loads and manages server definitions
- **Dependency Management**: Checks and installs npm packages
- **Build System**: Runs TypeScript compilation or other builds
- **Config Generation**: Creates Claude Desktop configurations
- **Connection Testing**: Validates MCP protocol responses
- **Platform Detection**: Finds Claude Desktop config location

#### 2. CLI Interface (hub/cli.js)
- **Command Parser**: Handles `--servername` direct launches
- **Interactive Menu**: Provides user-friendly selection interface
- **Progress Display**: Shows installation/build progress
- **Environment Collection**: Securely prompts for API keys
- **Status Display**: Shows server ready/installed/built state

#### 3. Registry (hub/registry.json)
- **Server Definitions**: Metadata for each MCP server
- **Command Mappings**: Install, build, start commands
- **Environment Schema**: Required/optional environment variables
- **Feature Lists**: Capabilities of each server
- **Status Tracking**: Installation and build state

### Server Lifecycle

1. **Discovery**: Hub reads registry.json for available servers
2. **Status Check**: Verifies if server is installed/built
3. **Installation**: Runs package manager to install dependencies
4. **Building**: Compiles TypeScript or runs build scripts
5. **Configuration**: Generates Claude Desktop JSON config
6. **Testing**: Sends MCP initialize request to verify
7. **Deployment**: Copies config to Claude Desktop location

## Environment Variables

Servers can require environment variables defined in registry.json:
- **sensitive**: true - Hides input (for passwords/tokens)
- **required**: true - Must be provided
- **description**: Shown to user during prompt

## Platform Support

The hub automatically detects your OS and Claude Desktop location:
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Best Practices

### For Server Developers
1. **Use ES modules** - Set `"type": "module"` in package.json
2. **Provide clear start commands** - Ensure stdio transport is default
3. **Document environment variables** - Add descriptions in registry
4. **Test locally first** - Verify server works before adding to hub
5. **Include error handling** - Graceful failures with clear messages
6. **Validate all inputs** - Use Zod schemas for type safety
7. **Log appropriately** - Use stderr for logs, stdout for protocol

### For Hub Users
1. **Test before deploying** - Use test feature before copying to Claude
2. **Use read-only mode** - For database servers when testing
3. **Backup configs** - Hub auto-backs up Claude Desktop configs
4. **Check logs** - Server errors appear in console output
5. **Restart Claude Desktop** - Required after config changes

## Windows-Specific Configuration (Updated 2025-08-30)

### Critical Windows Path Requirements

When configuring MCP servers for Claude Desktop on Windows, the generated configuration MUST use:

1. **Absolute paths** - Claude Desktop runs from its own directory and won't find relative paths
2. **Windows-style backslashes** - Use `\` not `/` in paths
3. **Working directory (cwd)** - Essential for monorepo servers to resolve dependencies

### Example Working Configuration

```json
{
  "mcpServers": {
    "supabase": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\Shayan\\Github_projects\\MCP_base_repo\\mcp-hub\\servers\\supabase\\packages\\mcp-server-supabase\\dist\\transports\\stdio.js",
        "--project-ref",
        "your-project-ref",
        "--read-only"
      ],
      "cwd": "C:\\Users\\Shayan\\Github_projects\\MCP_base_repo\\mcp-hub\\servers\\supabase",
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

### Supabase Server Setup (Fixed 2025-08-30)

The Supabase MCP server requires special handling as it's a pnpm monorepo:

1. **Installation**:
```powershell
cd mcp-hub\servers\supabase
Remove-Item -Recurse -Force node_modules  # Clean first if needed
pnpm install
pnpm build
```

2. **Testing**:
```powershell
$env:SUPABASE_ACCESS_TOKEN = "your-token"
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node packages\mcp-server-supabase\dist\transports\stdio.js --project-ref your-project-ref --read-only
```

3. **Hub Configuration Updates**:
The hub now automatically:
- Generates absolute Windows paths
- Adds the `cwd` property for proper module resolution
- Converts forward slashes to backslashes
- Uses full path to `node.exe`

### Adding New MCP Servers - Windows Guide

When adding a new MCP server to the hub for Windows:

1. **Update registry.json** with proper paths:
```json
{
  "servers": {
    "your-server": {
      "name": "Your Server",
      "description": "Description",
      "path": "./servers/your-server",
      "type": "node",
      "monorepo": false,  // Set true if using workspaces
      "packageManager": "npm",  // or "pnpm" for monorepos
      "commands": {
        "install": "npm install",
        "build": "npm run build",
        "start": "node dist/index.js"  // Relative to server path
      },
      "requiredEnv": {},
      "optionalArgs": ["--read-only"]
    }
  }
}
```

2. **For Monorepo Servers** (like Supabase):
- Set `"monorepo": true` in registry
- Use `pnpm install --frozen-lockfile` for installations
- The hub will automatically set `cwd` in the config

3. **Environment Variables**:
- Store in `.env` file at hub root
- Use namespaced variables (e.g., `SUPABASE_ACCESS_TOKEN`)
- Hub loads these automatically

### Common Windows Issues and Solutions

1. **MODULE_NOT_FOUND Error**:
   - **Cause**: Relative paths in config
   - **Solution**: Hub now generates absolute paths automatically

2. **Cannot find node_modules**:
   - **Cause**: Missing `cwd` property for monorepos
   - **Solution**: Hub now adds `cwd` automatically

3. **EPIPE Error**:
   - **Cause**: Server crashes on startup
   - **Solution**: Check environment variables and paths

4. **Test Fails but Server Works**:
   - **Cause**: Windows stdio handling issues
   - **Solution**: Type 'Y' to continue anyway when prompted

## Troubleshooting Checklist

- [ ] Node.js version 18+ installed
- [ ] Server builds successfully standalone
- [ ] TypeScript configured for ES modules if needed
- [ ] Absolute paths used in configuration (Windows)
- [ ] Working directory (cwd) set for monorepos
- [ ] Environment variables are provided
- [ ] Claude Desktop is fully closed before config update
- [ ] Server responds to MCP initialize request
- [ ] No conflicting server names in Claude config

## Quick Commands Reference

```bash
# Install hub
cd mcp-hub && npm install

# Interactive menu
npm run mcp

# Direct launch
npm run mcp -- --servername

# Manual test
cd servers/servername
node dist/stdio.js

# Check status
npm run mcp  # Then select "List All Servers"
```

## Resources for Learning More

### Official Documentation
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Example Servers](https://github.com/modelcontextprotocol/servers)

### Key Files in This Repository
- `Reference/Knowledge/mcp_intro_and_base_knowledge.md` - Core concepts
- `Reference/Knowledge/mcp_practical_server_guide.md` - Implementation patterns
- `Reference/MCP Server Examples/everything/` - Complete example server

This hub system makes it easy to manage multiple MCP servers, test them locally, and deploy to Claude Desktop with a consistent workflow.
- Always use most up to date and proper official best practices for implementations, including psycog3.