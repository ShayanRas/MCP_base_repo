#!/usr/bin/env node

/**
 * Registry Check Hook
 * Detects unregistered servers and prompts to add them to registry.json
 */

const fs = require('fs');
const path = require('path');

// Read input from Claude
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    checkRegistry(data);
  } catch (error) {
    process.exit(0);
  }
});

async function checkRegistry(data) {
  // Check if this is a Write operation
  if (data.tool_name !== 'Write') {
    process.exit(0);
    return;
  }
  
  const filePath = data.tool_input?.file_path || '';
  
  // Only check when files are created in servers directory
  if (!filePath.includes('mcp-hub/servers/')) {
    process.exit(0);
    return;
  }
  
  const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
  const serversDir = path.join(projectDir, 'mcp-hub', 'servers');
  const registryPath = path.join(projectDir, 'mcp-hub', 'hub', 'registry.json');
  
  try {
    // Load current registry
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    
    // Get all server directories
    const serverDirs = fs.readdirSync(serversDir).filter(dir => {
      const dirPath = path.join(serversDir, dir);
      return fs.statSync(dirPath).isDirectory() && dir !== 'node_modules';
    });
    
    // Find unregistered servers
    const unregistered = serverDirs.filter(dir => !registry.servers[dir]);
    
    if (unregistered.length > 0) {
      // Extract server name from current file path
      const pathParts = filePath.split('/');
      const serverIndex = pathParts.indexOf('servers');
      const currentServer = pathParts[serverIndex + 1];
      
      if (unregistered.includes(currentServer)) {
        // Check if this server has a package.json to determine type
        const packageJsonPath = path.join(serversDir, currentServer, 'package.json');
        const pyprojectPath = path.join(serversDir, currentServer, 'pyproject.toml');
        
        let serverType = 'node';
        let packageManager = 'npm';
        
        if (fs.existsSync(pyprojectPath)) {
          serverType = 'python';
          packageManager = 'uv';
        } else if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          // Check for pnpm workspace
          if (packageJson.workspaces) {
            packageManager = 'pnpm';
          }
        }
        
        const registryTemplate = {
          name: `${currentServer.charAt(0).toUpperCase() + currentServer.slice(1)} MCP Server`,
          description: "TODO: Add description of what this server does",
          path: `./servers/${currentServer}`,
          type: serverType,
          monorepo: false,
          packageManager: packageManager,
          commands: serverType === 'python' ? {
            install: "uv pip install -e .",
            build: "none",
            start: `python -m ${currentServer.replace(/-/g, '_')}.server`,
            test: `python -m ${currentServer.replace(/-/g, '_')}.server --test`
          } : {
            install: packageManager === 'pnpm' ? "pnpm install" : "npm install",
            build: "npm run build",
            start: "node dist/index.js",
            test: "npm test"
          },
          requiredEnv: {},
          optionalArgs: [],
          features: [],
          status: "not-installed",
          installed: false,
          built: false
        };
        
        const message = `
📝 Server '${currentServer}' is not registered in registry.json!

Add this to mcp-hub/hub/registry.json under "servers":

"${currentServer}": ${JSON.stringify(registryTemplate, null, 2)}

Remember to:
1. Update the description
2. Add any required environment variables
3. List the server's features
4. Adjust commands if needed
`;
        
        // Provide feedback to Claude about unregistered server
        console.log(JSON.stringify({
          decision: "block",
          reason: message
        }));
        process.exit(0);
      }
    }
    
    // Check if we're editing registry.json for a server that exists
    if (filePath.endsWith('registry.json')) {
      const registeredServers = Object.keys(registry.servers);
      const existingServers = serverDirs;
      
      // Find servers in registry that don't exist on disk
      const phantomServers = registeredServers.filter(s => !existingServers.includes(s));
      
      if (phantomServers.length > 0) {
        console.log(JSON.stringify({
          decision: "block",
          reason: `⚠️ Warning: Registry contains servers that don't exist on disk: ${phantomServers.join(', ')}`
        }));
        process.exit(0);
      }
    }
    
  } catch (error) {
    // Registry might not exist yet or be malformed
    if (error.code === 'ENOENT') {
      console.log(JSON.stringify({
        decision: "block",
        reason: "⚠️ Registry file not found. The registry should exist at mcp-hub/hub/registry.json"
      }));
      process.exit(0);
    }
  }
  
  // All good - exit cleanly
  process.exit(0);
}