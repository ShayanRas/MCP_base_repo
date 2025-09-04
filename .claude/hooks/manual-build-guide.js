#!/usr/bin/env node

/**
 * Manual Build Guide Hook
 * Guides users to manually test builds since Claude's shell has issues with npm/pnpm build outputs
 */

const fs = require('fs');
const path = require('path');

// Read input from Claude
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    checkBuildCommand(data);
  } catch (error) {
    // If there's an error, don't block - just pass through
    process.exit(0);
  }
});

async function checkBuildCommand(data) {
  // Check if this is a Bash command
  if (data.tool_name !== 'Bash') {
    process.exit(0);
    return;
  }
  
  const command = data.tool_input?.command || '';
  
  // Patterns that indicate build/compile commands
  const buildPatterns = [
    /npm\s+(run\s+)?build/i,
    /pnpm\s+(run\s+)?build/i,
    /yarn\s+(run\s+)?build/i,
    /npx\s+tsc/i,
    /tsc\s/i,
    /webpack/i,
    /rollup/i,
    /vite\s+build/i,
    /npm\s+test/i,
    /pnpm\s+test/i,
    /jest/i,
    /vitest/i
  ];
  
  // Check if command matches build patterns
  const isBuildCommand = buildPatterns.some(pattern => command.match(pattern));
  
  if (!isBuildCommand) {
    process.exit(0);
    return;
  }
  
  // Check if this is in the mcp-hub context
  const isMcpContext = command.includes('mcp') || 
                       data.tool_input?.cwd?.includes('mcp-hub') ||
                       process.cwd().includes('mcp-hub');
  
  // Extract what type of command this is
  let commandType = 'build';
  let suggestedCommand = command;
  
  if (command.includes('test')) {
    commandType = 'test';
  } else if (command.includes('tsc')) {
    commandType = 'TypeScript compilation';
  }
  
  // Determine the directory context
  let serverName = null;
  if (isMcpContext) {
    // Try to extract server name from command or cwd
    const cwdMatch = (data.tool_input?.cwd || '').match(/servers\/([^\/]+)/);
    if (cwdMatch) {
      serverName = cwdMatch[1];
    }
  }
  
  const message = `
⚠️ Build Command Detection

Claude's shell has known issues with build tool outputs (npm build, tsc, etc.).
These commands often appear to hang or not return results properly.

**Please run this manually in your terminal:**

\`\`\`bash
${serverName ? `cd mcp-hub/servers/${serverName}` : 'cd to your project directory'}
${suggestedCommand}
\`\`\`

**What to look for:**
${commandType === 'build' ? `
✅ Successful build:
- "Compiled successfully" or similar message
- dist/ or build/ folder created
- No TypeScript errors

❌ Build failures:
- Red error messages
- "error TS####" for TypeScript errors
- "Module not found" errors
` : ''}
${commandType === 'test' ? `
✅ Tests passing:
- Green checkmarks or "PASS" indicators
- Test summary showing passed/failed counts

❌ Test failures:
- Red X marks or "FAIL" indicators
- Stack traces showing where tests failed
` : ''}
${commandType === 'TypeScript compilation' ? `
✅ Successful compilation:
- No output (good news = no news for tsc)
- .js files created in dist/

❌ Compilation errors:
- "error TS####" messages
- Line numbers showing type errors
- Import/export issues
` : ''}

**After running manually:**
1. Tell me if it succeeded or failed
2. If it failed, paste the error message
3. I'll help you fix any issues

**Alternative**: You can also check the build by looking for:
- \`dist/\` folder existence
- Recent .js files in the output directory
- No .ts files with red underlines in your editor

${serverName ? `\n**For MCP Hub**: You can also use \`npm run mcp\` from the hub root to manage builds through the menu.` : ''}
`;
  
  // For PreToolUse hooks, we can ask the user or provide feedback
  // Using stdout to provide the message to the user  
  console.log(message);
  // Exit with code 0 to allow the command to proceed
  // (or exit 2 if we want to block it and have Claude handle differently)
  process.exit(0);
}