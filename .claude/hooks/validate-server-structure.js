#!/usr/bin/env node

/**
 * Server Structure Validation Hook
 * Ensures new MCP servers have proper directory structure and required files
 */

const fs = require('fs');
const path = require('path');

// Read input from Claude
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    validateServerStructure(data);
  } catch (error) {
    // Don't block on error
    console.log(JSON.stringify({ blocked: false }));
  }
});

async function validateServerStructure(data) {
  // Check if this is a package.json creation in servers directory
  const filePath = data.params?.file_path || data.file_path || '';
  
  if (!filePath.includes('mcp-hub/servers/') || !filePath.endsWith('package.json')) {
    console.log(JSON.stringify({ blocked: false }));
    return;
  }

  // Extract server name from path
  const pathParts = filePath.split('/');
  const serverIndex = pathParts.indexOf('servers');
  const serverName = pathParts[serverIndex + 1];
  
  if (!serverName) {
    console.log(JSON.stringify({ blocked: false }));
    return;
  }

  const serverDir = path.join(process.env.CLAUDE_PROJECT_DIR || '.', 'mcp-hub', 'servers', serverName);
  
  // Define required structure
  const requiredFiles = [
    'package.json',
    'README.md',
    'src/index.js',
    '.env.example'
  ];
  
  const requiredDirs = [
    'src',
    'dist'
  ];
  
  const issues = [];
  const suggestions = [];
  
  // Check for required files
  for (const file of requiredFiles) {
    const fullPath = path.join(serverDir, file);
    if (!fs.existsSync(fullPath)) {
      issues.push(`Missing required file: ${file}`);
      
      // Provide templates for missing files
      if (file === 'README.md') {
        suggestions.push(`Create README.md with:
# ${serverName} MCP Server

## Description
[Describe what this server does]

## Installation
\`\`\`bash
npm install
npm run build
\`\`\`

## Configuration
Copy \`.env.example\` to \`.env\` and fill in required values.

## Usage
This server is designed to be used with MCP clients like Claude Desktop.
`);
      }
      
      if (file === '.env.example') {
        suggestions.push(`Create .env.example with placeholders for required environment variables`);
      }
      
      if (file === 'src/index.js') {
        suggestions.push(`Create src/index.js as the main entry point for your MCP server`);
      }
    }
  }
  
  // Check for required directories
  for (const dir of requiredDirs) {
    const fullPath = path.join(serverDir, dir);
    if (!fs.existsSync(fullPath)) {
      issues.push(`Missing required directory: ${dir}`);
      suggestions.push(`Create ${dir}/ directory`);
    }
  }
  
  // Check package.json content
  try {
    const packageJsonPath = path.join(serverDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Check for MCP SDK dependency
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (!deps['@modelcontextprotocol/sdk']) {
        issues.push('Missing @modelcontextprotocol/sdk dependency');
        suggestions.push('Add MCP SDK: npm install @modelcontextprotocol/sdk');
      }
      
      // Check for required scripts
      const requiredScripts = ['build', 'start'];
      for (const script of requiredScripts) {
        if (!packageJson.scripts?.[script]) {
          issues.push(`Missing script: ${script}`);
          suggestions.push(`Add "${script}" script to package.json`);
        }
      }
    }
  } catch (error) {
    // Package.json might not be fully written yet
  }
  
  // Prepare response
  if (issues.length > 0) {
    const message = `
🔍 MCP Server Structure Validation for '${serverName}'

Issues found:
${issues.map(i => `  ❌ ${i}`).join('\n')}

Suggestions:
${suggestions.map(s => `  💡 ${s}`).join('\n')}

Next steps:
1. Create missing files and directories
2. Ensure package.json has MCP SDK and required scripts
3. Don't forget to register in hub/registry.json
`;
    
    console.log(JSON.stringify({
      blocked: false,
      message: message,
      metadata: {
        serverName,
        issues,
        suggestions
      }
    }));
  } else {
    console.log(JSON.stringify({
      blocked: false,
      message: `✅ Server structure for '${serverName}' looks good! Don't forget to register it in hub/registry.json`,
      metadata: {
        serverName,
        valid: true
      }
    }));
  }
}