# Claude Code Hooks & Settings: The Complete Guide for MCP Development

## Table of Contents
1. [Introduction: Why This Matters](#introduction)
2. [Settings Fundamentals](#settings-fundamentals)
3. [Understanding Hooks](#understanding-hooks)
4. [Creating Your First Hook](#creating-your-first-hook)
5. [MCP-Specific Hook Patterns](#mcp-specific-patterns)
6. [Settings for Vibe Coders](#settings-for-vibe-coders)
7. [Security & Best Practices](#security-best-practices)
8. [Templates & Examples](#templates-examples)

---

## Introduction: Why This Matters {#introduction}

### What Are Hooks and Settings?

**Settings** are configuration files that control how Claude Code behaves in your project. Think of them as the "preferences" that tell Claude what it can and cannot do.

**Hooks** are automated scripts that run at specific moments during your Claude Code session. They're like "if this happens, then do that" rules that work automatically.

### Why Vibe Coders Need This

As a vibe coder building MCP servers, hooks and settings give you:
- **Automatic safety checks** before you ship broken code
- **Custom prompts** that guide Claude based on what you're doing
- **Error prevention** by catching mistakes before they happen
- **Learning assistance** through contextual help
- **Team consistency** by sharing configurations

---

## Settings Fundamentals {#settings-fundamentals}

### Where Settings Live

Claude Code looks for settings in this order (first wins):

1. **Enterprise Managed** (IT department controls)
   - Windows: `C:\ProgramData\ClaudeCode\managed-settings.json`
   - Mac: `/Library/Application Support/ClaudeCode/managed-settings.json`
   - Linux: `/etc/claude-code/managed-settings.json`

2. **Command Line Arguments** (when you run Claude)
   ```bash
   claude --model claude-opus-4-1-20250805
   ```

3. **Project Local Settings** (your personal, not shared)
   ```
   your-project/
   └── .claude/
       └── settings.local.json  # Git ignores this
   ```

4. **Project Shared Settings** (team shares these)
   ```
   your-project/
   └── .claude/
       └── settings.json  # Commit this to Git
   ```

5. **User Settings** (your defaults)
   ```
   ~/.claude/settings.json
   ```

### Basic Settings Structure

```json
{
  "model": "claude-opus-4-1-20250805",
  "permissions": {
    "allow": ["Bash(npm test)", "Read(**/*.js)"],
    "deny": ["Read(.env)", "Bash(rm -rf)"]
  },
  "env": {
    "NODE_ENV": "development",
    "DEBUG": "true"
  },
  "hooks": {
    // Hook configurations go here
  }
}
```

### Committing and Sharing Settings

To share settings with your team:

1. **Create shared settings**:
   ```bash
   mkdir .claude
   touch .claude/settings.json
   ```

2. **Add useful team settings**:
   ```json
   {
     "permissions": {
       "deny": ["Read(.env)", "Write(*.prod.*)"]
     },
     "hooks": {
       "PreToolUse": [/* team hooks */]
     }
   }
   ```

3. **Commit to Git**:
   ```bash
   git add .claude/settings.json
   git commit -m "Add team Claude settings"
   ```

4. **Keep personal settings separate**:
   ```bash
   # .claude/settings.local.json (not committed)
   {
     "env": {
       "MY_PERSONAL_TOKEN": "xxx"
     }
   }
   ```

---

## Understanding Hooks {#understanding-hooks}

### What Hooks Do

Hooks are shell commands that run automatically at specific points:

```
User types → [Hook runs] → Claude thinks → [Hook runs] → Action happens → [Hook runs]
```

### Available Hook Types

| Hook | When It Runs | Common Use |
|------|--------------|------------|
| `UserPromptSubmit` | User hits enter | Inject context, block dangerous requests |
| `PreToolUse` | Before any tool runs | Validate, backup, security checks |
| `PostToolUse` | After tool completes | Format code, run tests, update docs |
| `SessionStart` | New session begins | Load project context, check environment |
| `SessionEnd` | Session ends | Save work, generate summary |
| `Stop` | Claude finishes responding | Final checks, cleanup |
| `PreCompact` | Before context compression | Save important context |

### Hook Input/Output

Hooks receive JSON via stdin and can return JSON to control behavior:

**Input** (what your hook receives):
```json
{
  "tool": "Edit",
  "params": {
    "file_path": "/src/server.js",
    "old_string": "console.log",
    "new_string": "logger.info"
  },
  "context": {
    "session_id": "abc123",
    "message_count": 5
  }
}
```

**Output** (what your hook can return):
```json
{
  "blocked": false,
  "message": "Replacing console.log with proper logging",
  "modifiedParams": {
    "new_string": "logger.info // TODO: Configure logger"
  }
}
```

### Hook Configuration Syntax

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit(**/*.js)",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/validate-js.js"
          }
        ]
      }
    ]
  }
}
```

---

## Creating Your First Hook {#creating-your-first-hook}

### Step 1: Create Hook Script

Create `.claude/hooks/safety-check.js`:

```javascript
#!/usr/bin/env node

// Read input from Claude
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(input);
  
  // Check for dangerous operations
  if (data.tool === 'Bash' && data.params.command.includes('rm -rf')) {
    console.log(JSON.stringify({
      blocked: true,
      message: "⚠️ Dangerous command blocked! Use safer deletion methods."
    }));
    return;
  }
  
  // Check for exposed secrets
  if (data.tool === 'Write' || data.tool === 'Edit') {
    const content = data.params.content || data.params.new_string || '';
    if (content.match(/api[_-]?key\s*=\s*["'][^"']+["']/i)) {
      console.log(JSON.stringify({
        blocked: true,
        message: "🔐 Detected API key in code! Use environment variables instead."
      }));
      return;
    }
  }
  
  // Allow the operation
  console.log(JSON.stringify({ blocked: false }));
});
```

### Step 2: Register the Hook

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/safety-check.js"
          }
        ]
      }
    ]
  }
}
```

### Step 3: Test Your Hook

1. Try to write code with an API key - it should block
2. Try to run `rm -rf /` - it should block
3. Normal operations should work fine

---

## MCP-Specific Hook Patterns {#mcp-specific-patterns}

### Pattern 1: Brain Dump Detection

Detect when user is describing their MCP idea and inject helpful context:

```javascript
// .claude/hooks/brain-dump-detector.js
const patterns = [
  /i want to build/i,
  /my idea is/i,
  /mcp.*server/i,
  /create.*tool/i
];

if (patterns.some(p => data.userMessage.match(p))) {
  console.log(JSON.stringify({
    enhancedPrompt: data.userMessage + `
    
    [MCP CONTEXT INJECTED]
    Remember to ask about:
    - Authentication requirements
    - Expected user count
    - Data persistence needs
    - Security considerations
    `,
    blocked: false
  }));
}
```

### Pattern 2: Error Translation

Make errors understandable for vibe coders:

```javascript
// .claude/hooks/error-translator.js
const errorMappings = {
  "Cannot find module": "A required package is missing. Run: npm install",
  "undefined is not a function": "You're calling something that doesn't exist. Check spelling!",
  "ENOENT": "File or directory doesn't exist. Check the path!",
  "EACCES": "Permission denied. You might need admin rights.",
  "SyntaxError": "Your code has a typo. Check brackets and quotes!"
};

if (data.tool === 'Bash' && data.output?.error) {
  for (const [pattern, translation] of Object.entries(errorMappings)) {
    if (data.output.error.includes(pattern)) {
      console.log(JSON.stringify({
        message: `\n🎯 Plain English: ${translation}\n`,
        blocked: false
      }));
      break;
    }
  }
}
```

### Pattern 3: Production Readiness Check

Before deploying MCP servers:

```javascript
// .claude/hooks/production-check.js
const checks = [
  { 
    file: 'README.md', 
    required: true, 
    message: 'Missing README documentation' 
  },
  { 
    pattern: /console\.log/g, 
    forbidden: true, 
    message: 'Remove console.log statements' 
  },
  { 
    pattern: /TODO|FIXME/g, 
    warning: true, 
    message: 'Unfinished TODOs found' 
  }
];

// Run checks and block if critical issues found
```

### Pattern 4: Auto-Documentation

Generate docs as code is written:

```javascript
// .claude/hooks/auto-docs.js
if (data.tool === 'Write' && data.params.file_path.endsWith('.js')) {
  // Extract function signatures
  const functions = extractFunctions(data.params.content);
  
  // Generate companion .md file
  const docPath = data.params.file_path.replace('.js', '.docs.md');
  const documentation = generateDocs(functions);
  
  // Queue follow-up action
  console.log(JSON.stringify({
    followUp: {
      tool: 'Write',
      params: {
        file_path: docPath,
        content: documentation
      }
    }
  }));
}
```

---

## Settings for Vibe Coders {#settings-for-vibe-coders}

### Essential MCP Development Settings

```json
{
  "model": "claude-opus-4-1-20250805",
  
  "permissions": {
    "allow": [
      "Bash(npm *)",           // Allow all npm commands
      "Read(**/*)",            // Read any file
      "Write(servers/**/*)",   // Write in servers directory
      "Edit(**/*)"            // Edit any file
    ],
    "deny": [
      "Bash(rm -rf /)",       // Prevent disasters
      "Read(**/*.key)",       // Don't read private keys
      "Write(.env)",          // Don't overwrite env
      "Bash(git push --force)" // No force pushes
    ]
  },
  
  "env": {
    "NODE_ENV": "development",
    "MCP_DEBUG": "true",
    "CLAUDE_PROJECT_TYPE": "mcp-server"
  },
  
  "options": {
    "autoTest": true,         // Run tests after changes
    "formatOnSave": true,     // Auto-format code
    "verboseErrors": true     // Detailed error messages
  }
}
```

### Team Collaboration Settings

For teams building MCP servers together:

```json
{
  "team": {
    "codeStyle": "standard",
    "testRunner": "jest",
    "requiredFiles": ["README.md", "LICENSE", ".env.example"]
  },
  
  "hooks": {
    "PreCommit": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "npm run lint && npm test"
      }]
    }]
  },
  
  "permissions": {
    "deny": [
      "Write(main)",           // Protect main branch
      "Write(*.prod.*)",       // Protect production configs
      "Read(secrets/*)"        // Protect secrets directory
    ]
  }
}
```

---

## Security & Best Practices {#security-best-practices}

### Security Rules for Hooks

1. **Never trust user input**
   ```javascript
   // BAD
   exec(`rm ${userInput}`);
   
   // GOOD
   if (isValidPath(userInput)) {
     exec(`rm "${sanitize(userInput)}"`);
   }
   ```

2. **Use absolute paths**
   ```javascript
   // BAD
   command: "hooks/check.js"
   
   // GOOD
   command: "${CLAUDE_PROJECT_DIR}/.claude/hooks/check.js"
   ```

3. **Set timeouts**
   ```javascript
   // Hooks timeout after 60 seconds by default
   // For faster hooks, fail fast:
   setTimeout(() => {
     console.log(JSON.stringify({
       blocked: true,
       message: "Hook timeout"
     }));
     process.exit(1);
   }, 5000);
   ```

4. **Validate paths**
   ```javascript
   // Prevent path traversal
   if (filePath.includes('../')) {
     return { blocked: true, message: "Path traversal detected" };
   }
   ```

### Best Practices

1. **Make hooks idempotent** - Running twice should be safe
2. **Fail gracefully** - Don't crash on unexpected input
3. **Log for debugging** - But not sensitive data
4. **Keep hooks fast** - Under 5 seconds ideally
5. **Version control hooks** - Include in your repo
6. **Document hook behavior** - Help your team understand

---

## Templates & Examples {#templates-examples}

### Complete MCP Project Settings Template

Save as `.claude/settings.json`:

```json
{
  "model": "claude-opus-4-1-20250805",
  
  "env": {
    "PROJECT_TYPE": "mcp-server",
    "NODE_ENV": "development"
  },
  
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(node *)",
      "Read(**/*)",
      "Write(servers/**/*)",
      "Edit(**/*)"
    ],
    "deny": [
      "Read(.env)",
      "Write(.env)",
      "Bash(rm -rf)",
      "Bash(*sudo*)"
    ]
  },
  
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "*brainstorm*",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/brainstorm-mode.js"
      }]
    }],
    
    "PreToolUse": [{
      "matcher": "Write(**/*.js)",
      "hooks": [{
        "type": "command",
        "command": "node ${CLAUDE_PROJECT_DIR}/.claude/hooks/validate-js.js"
      }]
    }],
    
    "PostToolUse": [{
      "matcher": "Edit(**/*.js)",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write ${FILE_PATH}"
      }]
    }],
    
    "SessionStart": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "echo 'MCP Development Session Started' && npm run check-env"
      }]
    }]
  }
}
```

### Starter Hook Collection

Create these in `.claude/hooks/`:

**1. Secret Scanner** (`secret-scanner.js`):
```javascript
#!/usr/bin/env node
const secrets = [
  /api[_-]?key\s*[:=]\s*["'][^"']{20,}/gi,
  /token\s*[:=]\s*["'][^"']{20,}/gi,
  /password\s*[:=]\s*["'][^"']+/gi
];

// Check content for secrets
if (secrets.some(pattern => content.match(pattern))) {
  console.log(JSON.stringify({
    blocked: true,
    message: "🔐 Secret detected! Use environment variables instead."
  }));
}
```

**2. Test Runner** (`auto-test.js`):
```javascript
#!/usr/bin/env node
// Run tests after code changes
if (data.tool === 'Write' || data.tool === 'Edit') {
  if (data.params.file_path.includes('/src/')) {
    console.log(JSON.stringify({
      followUp: {
        tool: 'Bash',
        params: { command: 'npm test' }
      }
    }));
  }
}
```

**3. MCP Validator** (`mcp-validator.js`):
```javascript
#!/usr/bin/env node
// Validate MCP server structure
const required = [
  'package.json',
  'src/index.js',
  'README.md'
];

// Check and report missing files
```

### Troubleshooting Guide

| Problem | Solution |
|---------|----------|
| Hook doesn't run | Check matcher pattern, ensure hook file is executable |
| Hook blocks everything | Add `console.error()` for debugging, check return values |
| Settings not loading | Check file location, validate JSON syntax |
| Permissions denied | Settings precedence - check for overrides |
| Hook timeout | Optimize code, increase timeout, or run async |

### Environment Variables

Available in hooks:
- `CLAUDE_PROJECT_DIR` - Project root directory
- `CLAUDE_SESSION_ID` - Current session ID
- `CLAUDE_MESSAGE_COUNT` - Messages in session
- Custom vars from settings `env` section

---

## Summary

Hooks and settings transform Claude Code from a tool into your personalized MCP development environment. They:

1. **Protect you** from common mistakes
2. **Guide you** through complex processes
3. **Automate** repetitive tasks
4. **Teach you** best practices
5. **Maintain** consistency across your team

Start simple with basic safety hooks, then gradually add more sophisticated automation as you grow comfortable with the system.

Remember: Every hook is an opportunity to prevent a future bug or teach yourself something new. Use them wisely!