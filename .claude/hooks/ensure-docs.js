#!/usr/bin/env node

/**
 * Documentation Enforcement Hook
 * Ensures MCP servers have proper documentation
 */

const fs = require('fs');
const path = require('path');

// Read input from Claude
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    ensureDocumentation(data);
  } catch (error) {
    console.log(JSON.stringify({ blocked: false }));
  }
});

async function ensureDocumentation(data) {
  const filePath = data.params?.file_path || data.file_path || '';
  
  // Trigger on package.json creation or main file updates
  if (!filePath.includes('mcp-hub/servers/') || 
      (!filePath.endsWith('package.json') && !filePath.endsWith('index.js'))) {
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
  const readmePath = path.join(serverDir, 'README.md');
  const registryPath = path.join(projectDir, 'mcp-hub', 'hub', 'registry.json');
  
  const issues = [];
  const suggestions = [];
  
  // Check if README exists
  if (!fs.existsSync(readmePath)) {
    issues.push('Missing README.md');
    
    // Load registry to get server info
    let serverInfo = {
      name: serverName,
      description: 'MCP server',
      features: []
    };
    
    try {
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      if (registry.servers[serverName]) {
        serverInfo = registry.servers[serverName];
      }
    } catch (error) {
      // Registry might not exist yet
    }
    
    // Generate README template
    const readmeTemplate = `# ${serverInfo.name || serverName}

## Description
${serverInfo.description || 'TODO: Add description of what this MCP server does'}

## Features
${serverInfo.features && serverInfo.features.length > 0 
  ? serverInfo.features.map(f => `- ${f}`).join('\n')
  : '- TODO: List key features\n- TODO: Add more features'}

## Installation

### Prerequisites
- Node.js 18+ (for Node.js servers)
- Python 3.10+ (for Python servers)
- MCP-compatible client (Claude Desktop, Claude Code, etc.)

### Setup
1. Clone this repository
2. Navigate to the server directory:
   \`\`\`bash
   cd mcp-hub/servers/${serverName}
   \`\`\`

3. Install dependencies:
   \`\`\`bash
   ${serverInfo.type === 'python' ? 'uv pip install -e .' : 'npm install'}
   \`\`\`

4. Build the server:
   \`\`\`bash
   ${serverInfo.type === 'python' ? '# No build needed for Python' : 'npm run build'}
   \`\`\`

## Configuration

### Environment Variables
${serverInfo.requiredEnv && Object.keys(serverInfo.requiredEnv).length > 0
  ? 'Copy `.env.example` to `.env` and configure:\n\n' + 
    Object.entries(serverInfo.requiredEnv).map(([key, config]) => 
      `- \`${key}\`: ${config.description || 'TODO: Add description'}`
    ).join('\n')
  : 'No environment variables required.'}

### MCP Hub Integration
This server can be launched through the MCP Hub:

\`\`\`bash
cd mcp-hub
npm run mcp -- --${serverName}
\`\`\`

## Usage

### With Claude Desktop
1. Use MCP Hub to generate configuration:
   \`\`\`bash
   npm run mcp
   \`\`\`
2. Select "Generate Configuration" for ${serverName}
3. Copy config to Claude Desktop
4. Restart Claude Desktop

### Direct Usage
\`\`\`bash
${serverInfo.commands?.start || 'node dist/index.js'}
\`\`\`

## API Reference

### Tools
TODO: Document available tools

### Resources
TODO: Document available resources

### Prompts
TODO: Document available prompts

## Examples

### Basic Usage
\`\`\`javascript
// TODO: Add usage example
\`\`\`

### Advanced Usage
\`\`\`javascript
// TODO: Add advanced example
\`\`\`

## Development

### Testing
\`\`\`bash
npm test
\`\`\`

### Debugging
Enable debug mode:
\`\`\`bash
DEBUG=mcp:* npm start
\`\`\`

## Troubleshooting

### Common Issues
- **Connection refused**: Check if the server is running
- **Authentication error**: Verify environment variables
- **Module not found**: Run \`npm install\` or \`npm run build\`

## Contributing
Pull requests are welcome! Please ensure:
- All tests pass
- Code follows existing style
- Documentation is updated

## License
[Specify license]
`;
    
    suggestions.push(`Create README.md with the generated template (customize as needed)`);
    
    // Also suggest the content
    console.log(JSON.stringify({
      blocked: false,
      message: `
📚 Documentation Check for '${serverName}'

Issues:
${issues.map(i => `  ❌ ${i}`).join('\n')}

Suggestion:
${suggestions.join('\n')}

README.md template has been prepared. Key sections to complete:
- Description of what the server does
- List of features
- API documentation (tools, resources, prompts)
- Usage examples
- Troubleshooting guide
`,
      metadata: {
        serverName,
        missingReadme: true,
        template: readmeTemplate
      }
    }));
    return;
  }
  
  // If README exists, check its completeness
  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  const requiredSections = [
    { pattern: /#+\s*Description/i, name: 'Description' },
    { pattern: /#+\s*Installation/i, name: 'Installation' },
    { pattern: /#+\s*Configuration/i, name: 'Configuration' },
    { pattern: /#+\s*Usage/i, name: 'Usage' },
    { pattern: /#+\s*(API|Tools|Resources)/i, name: 'API Reference' }
  ];
  
  const missingSections = requiredSections
    .filter(section => !readmeContent.match(section.pattern))
    .map(section => section.name);
  
  if (missingSections.length > 0) {
    issues.push(`README.md missing sections: ${missingSections.join(', ')}`);
    suggestions.push('Add missing sections to provide complete documentation');
  }
  
  // Check for TODO markers
  const todoCount = (readmeContent.match(/TODO/gi) || []).length;
  if (todoCount > 0) {
    issues.push(`README.md has ${todoCount} TODO items`);
    suggestions.push('Complete the TODO items in documentation');
  }
  
  // Check for examples
  if (!readmeContent.includes('```')) {
    issues.push('No code examples in README.md');
    suggestions.push('Add code examples to demonstrate usage');
  }
  
  // Response
  if (issues.length > 0) {
    console.log(JSON.stringify({
      blocked: false,
      message: `
📚 Documentation Review for '${serverName}'

Issues found:
${issues.map(i => `  ⚠️ ${i}`).join('\n')}

Suggestions:
${suggestions.map(s => `  💡 ${s}`).join('\n')}

Good documentation helps vibe coders understand and use your server!
`,
      metadata: {
        serverName,
        issues,
        suggestions
      }
    }));
  } else {
    console.log(JSON.stringify({
      blocked: false,
      message: `✅ Documentation for '${serverName}' looks complete!`,
      metadata: {
        serverName,
        complete: true
      }
    }));
  }
}