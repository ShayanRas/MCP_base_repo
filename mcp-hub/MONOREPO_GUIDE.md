# Monorepo MCP Servers Guide

## Understanding Monorepo Servers

Some MCP servers (like Supabase) use a monorepo structure with workspaces. This requires special handling for module resolution.

### Structure Example
```
supabase/
├── node_modules/           ← Dependencies installed HERE (hoisted)
├── packages/
│   ├── mcp-server-supabase/
│   │   └── dist/
│   │       └── transports/stdio.js  ← Entry point
│   └── mcp-utils/
└── pnpm-workspace.yaml    ← Workspace configuration
```

## Key Differences

### Regular Servers
- Dependencies in same directory as code
- Can run from any location with absolute paths
- Example: `everything` server

### Monorepo Servers
- Dependencies hoisted to root `node_modules/`
- MUST run from workspace root directory
- Use relative paths for module resolution
- Example: `supabase` server

## Configuration

### In registry.json
```json
{
  "servers": {
    "your-monorepo-server": {
      "monorepo": true,  // ← Critical flag!
      "path": "./servers/your-server",
      "commands": {
        "start": "node packages/sub-package/dist/index.js"
        // ↑ Keep relative, don't use absolute paths
      }
    }
  }
}
```

### What the Hub Does

For monorepo servers (`monorepo: true`):
1. **Keeps paths relative** - Doesn't convert to absolute
2. **Sets working directory** - Runs from server root
3. **Adds cwd to config** - Claude Desktop uses correct directory

## Testing Monorepo Servers

### Option 1: Use npm/pnpm scripts
```bash
cd mcp-hub/servers/supabase
npm run start         # Added by our fixes
npm run start:test    # With test message
```

### Option 2: Use test helper
```bash
cd mcp-hub/servers/supabase
node test-mcp.js      # Interactive test script
```

### Option 3: Manual test (correct way)
```bash
cd mcp-hub/servers/supabase  # ← Must be in root!
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node packages/mcp-server-supabase/dist/transports/stdio.js
```

### ❌ Wrong way (will fail)
```bash
cd mcp-hub/servers/supabase/packages/mcp-server-supabase
node dist/transports/stdio.js  # ← Fails: Can't find modules!
```

## Common Errors

### Error: Cannot find package '@modelcontextprotocol/sdk'
**Cause**: Running from wrong directory or using absolute path
**Fix**: 
1. Ensure `monorepo: true` in registry.json
2. Run from workspace root directory
3. Use relative paths in commands

### Error: Module not found
**Cause**: Dependencies not installed or not hoisted
**Fix**:
```bash
cd mcp-hub/servers/supabase
pnpm install  # For pnpm workspaces
# or
npm install   # For npm workspaces
```

## Adding a New Monorepo Server

1. **Copy server to hub**
   ```bash
   cp -r your-monorepo-server mcp-hub/servers/
   ```

2. **Update registry.json**
   ```json
   {
     "your-server": {
       "monorepo": true,  // ← Don't forget this!
       "packageManager": "pnpm",  // or "npm"
       "commands": {
         "install": "pnpm install",
         "build": "pnpm build",
         "start": "node packages/main/dist/index.js"
       }
     }
   }
   ```

3. **Add helper scripts** (optional but recommended)
   ```json
   // In root package.json
   {
     "scripts": {
       "start": "node packages/main/dist/index.js",
       "test:mcp": "node test-mcp.js"
     }
   }
   ```

4. **Test it**
   ```bash
   npm run mcp -- --your-server
   ```

## Workspace Types

### pnpm Workspaces
- Uses `pnpm-workspace.yaml`
- Dependencies hoisted by default
- Example: Supabase server

### npm Workspaces
- Defined in root `package.json`
- Uses `workspaces` field
- Dependencies hoisted by default

### Yarn Workspaces
- Similar to npm workspaces
- Uses `workspaces` field in package.json

### Lerna
- Can use npm/yarn/pnpm under the hood
- Check `lerna.json` for configuration

## Debugging Tips

1. **Check working directory**
   ```javascript
   console.log('CWD:', process.cwd());
   console.log('__dirname:', __dirname);
   ```

2. **Verify module resolution**
   ```bash
   node -e "console.log(require.resolve('@modelcontextprotocol/sdk'))"
   ```

3. **List installed packages**
   ```bash
   # From workspace root
   pnpm ls  # or npm ls
   ```

4. **Check NODE_PATH**
   ```bash
   echo $NODE_PATH
   ```

## Hub Implementation Details

The hub automatically handles monorepos by:

1. **Detection**: Checks `monorepo` flag in registry.json
2. **Path handling**: Keeps relative paths for monorepos
3. **Working directory**: Sets cwd to server root
4. **Config generation**: Adds cwd field for Claude Desktop

This ensures proper module resolution without manual intervention.