#!/usr/bin/env node

/**
 * Auto Build and Test Hook
 * Automatically builds and tests MCP servers after implementation changes
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Read input from Claude
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    autoBuildTest(data);
  } catch (error) {
    console.log(JSON.stringify({ blocked: false }));
  }
});

async function autoBuildTest(data) {
  const filePath = data.params?.file_path || data.file_path || '';
  
  // Only trigger for source files in servers
  if (!filePath.includes('mcp-hub/servers/') || !filePath.includes('/src/')) {
    console.log(JSON.stringify({ blocked: false }));
    return;
  }
  
  // Extract server name
  const pathParts = filePath.split('/');
  const serverIndex = pathParts.indexOf('servers');
  const serverName = pathParts[serverIndex + 1];
  
  if (!serverName) {
    console.log(JSON.stringify({ blocked: false }));
    return;
  }
  
  const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
  const serverDir = path.join(projectDir, 'mcp-hub', 'servers', serverName);
  const registryPath = path.join(projectDir, 'mcp-hub', 'hub', 'registry.json');
  
  // Load workflow state
  const stateFile = path.join(__dirname, 'state', 'workflow.json');
  let state = {};
  
  try {
    if (fs.existsSync(stateFile)) {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
  } catch (error) {
    state = {};
  }
  
  // Initialize server state
  if (!state[serverName]) {
    state[serverName] = {
      lastBuild: null,
      lastTest: null,
      buildCount: 0,
      testCount: 0
    };
  }
  
  // Throttle builds (don't build more than once per 30 seconds)
  const now = Date.now();
  if (state[serverName].lastBuild && (now - state[serverName].lastBuild) < 30000) {
    console.log(JSON.stringify({
      blocked: false,
      message: `⏱️ Skipping build for ${serverName} (recently built)`,
      metadata: { throttled: true }
    }));
    return;
  }
  
  try {
    // Load registry to get build commands
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const serverConfig = registry.servers[serverName];
    
    if (!serverConfig) {
      console.log(JSON.stringify({
        blocked: false,
        message: `⚠️ Server ${serverName} not found in registry. Register it first!`
      }));
      return;
    }
    
    // Check if package.json or pyproject.toml exists
    const packageJsonPath = path.join(serverDir, 'package.json');
    const pyprojectPath = path.join(serverDir, 'pyproject.toml');
    
    if (!fs.existsSync(packageJsonPath) && !fs.existsSync(pyprojectPath)) {
      console.log(JSON.stringify({
        blocked: false,
        message: `⚠️ No package.json or pyproject.toml found for ${serverName}`
      }));
      return;
    }
    
    const messages = [];
    const results = {};
    
    // Check if dependencies are installed
    const nodeModulesPath = path.join(serverDir, 'node_modules');
    const venvPath = path.join(serverDir, '.venv');
    
    const depsInstalled = serverConfig.type === 'python' 
      ? fs.existsSync(venvPath)
      : fs.existsSync(nodeModulesPath);
    
    if (!depsInstalled) {
      messages.push(`📦 Dependencies not installed. Run: npm run mcp -- --${serverName}`);
      results.needsInstall = true;
    } else {
      // Try to build if it's a Node.js server
      if (serverConfig.type === 'node' && serverConfig.commands.build !== 'none') {
        try {
          messages.push(`🔨 Building ${serverName}...`);
          
          const buildCmd = serverConfig.packageManager === 'pnpm' 
            ? 'pnpm build'
            : 'npm run build';
          
          const { stdout, stderr } = await execAsync(buildCmd, { 
            cwd: serverDir,
            timeout: 60000 // 60 second timeout
          });
          
          state[serverName].lastBuild = now;
          state[serverName].buildCount++;
          
          messages.push(`✅ Build successful!`);
          results.buildSuccess = true;
          
          // Check if dist directory was created
          const distPath = path.join(serverDir, 'dist');
          if (!fs.existsSync(distPath)) {
            messages.push(`⚠️ Warning: No dist/ directory created after build`);
          }
          
        } catch (error) {
          messages.push(`❌ Build failed: ${error.message}`);
          results.buildFailed = true;
          
          // Provide helpful error messages
          if (error.message.includes('tsc')) {
            messages.push(`💡 TypeScript compilation error. Check your TypeScript code.`);
          } else if (error.message.includes('module')) {
            messages.push(`💡 Module not found. Check your imports and dependencies.`);
          }
        }
      }
      
      // Suggest testing
      if (results.buildSuccess || serverConfig.type === 'python') {
        messages.push(`🧪 Ready to test! Run: npm run mcp -- --test`);
        
        // Check for test files
        const testDir = path.join(serverDir, 'test');
        const testsDir = path.join(serverDir, 'tests');
        const hasTests = fs.existsSync(testDir) || fs.existsSync(testsDir);
        
        if (!hasTests) {
          messages.push(`💡 Consider adding tests in a test/ directory`);
        }
      }
    }
    
    // Save state
    try {
      const stateDir = path.dirname(stateFile);
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      // State saving is non-critical
    }
    
    // Send response
    if (messages.length > 0) {
      console.log(JSON.stringify({
        blocked: false,
        message: `
🤖 Auto Build/Test for '${serverName}'

${messages.join('\n')}

Server stats:
- Build count: ${state[serverName].buildCount}
- Last build: ${state[serverName].lastBuild ? new Date(state[serverName].lastBuild).toLocaleTimeString() : 'Never'}
`,
        metadata: {
          serverName,
          results,
          state: state[serverName]
        }
      }));
    } else {
      console.log(JSON.stringify({ blocked: false }));
    }
    
  } catch (error) {
    console.log(JSON.stringify({
      blocked: false,
      message: `⚠️ Build/test check error: ${error.message}`
    }));
  }
}