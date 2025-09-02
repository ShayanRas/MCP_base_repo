# MCP Hub Claude Code Configuration

This directory contains Claude Code settings and hooks that enhance your MCP development experience.

## 🚀 Quick Start

Just type one of these phrases to start an MCP consultation:
- `begin brainstorming`
- `start brainstorming`
- `let's brainstorm`
- `help me brainstorm`
- `i want to build an mcp server`

Claude will automatically transform into X, your expert MCP consultant, and guide you through the entire process.

## 📁 Directory Structure

```
.claude/
├── settings.json          # Main configuration file
├── hooks/
│   ├── brainstorm.js     # Brainstorming mode hook
│   ├── prompts/          # Prompt templates
│   │   ├── x-persona.md  # X consultant personality
│   │   └── process.md    # Consultation process
│   └── state/            # Session state tracking
│       └── *.json        # Session files (git-ignored)
└── README.md             # This file
```

## 🎯 Features

### Automatic Brainstorming Mode
When you type a trigger phrase, the hook:
1. Activates X consultant persona
2. References MCP knowledge base automatically
3. Guides you through structured consultation
4. Tracks your progress through phases
5. Generates project documentation

### Consultation Phases
1. **Brain Dump** - Express your idea freely
2. **Clarification** - Refine requirements
3. **Planning** - Technical approach
4. **Documentation** - Create CLAUDE.md
5. **Implementation** - Build the server

### Permissions & Safety
- Allows necessary operations for MCP development
- Blocks dangerous commands (rm -rf, sudo, force push)
- Protects sensitive files (.env, *.key)
- Enables web search and fetch for research

## 🔧 Customization

### Modify Triggers
Edit `.claude/hooks/brainstorm.js` to add more trigger phrases:
```javascript
const TRIGGERS = [
  /^begin\s+brainstorm(?:ing)?/i,
  /^your\s+new\s+trigger/i,  // Add your own
];
```

### Adjust Personas
Edit `.claude/hooks/prompts/x-persona.md` to customize X's personality and expertise.

### Change Process
Edit `.claude/hooks/prompts/process.md` to modify the consultation workflow.

## 🔒 Security Notes

- Session state files in `/state` are git-ignored
- No sensitive data is stored in tracked files
- Hooks have 60-second timeout protection
- All operations are logged for debugging

## 🧪 Testing

To test the hook without Claude Code:
```bash
echo '{"userMessage":"begin brainstorming"}' | node .claude/hooks/brainstorm.js
```

## 📝 Settings Overview

The `settings.json` configures:
- **Model**: Claude Opus 4.1
- **Environment**: MCP development mode
- **Permissions**: Safe MCP development access
- **Hooks**: Automatic brainstorming activation

## 🤝 Sharing

This configuration is designed to be shared:
1. Commit `.claude/` directory to your repo
2. Team members get same experience
3. Personal settings go in `.claude/settings.local.json`

## 📚 Learn More

- See `/Reference/hooks_and_settings.md` for complete documentation
- Review `/Reference/Knowledge/` for MCP expertise
- Check `/mcp-hub/servers/` for examples

## 💡 Tips

- Say "begin brainstorming" to start fresh consultation
- The hook remembers your session for 24 hours
- Check `.claude/hooks/state/` to see session data
- Modify prompts to match your style

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Hook not activating | Check if settings.json is loaded (restart Claude Code) |
| Session stuck | Delete `.claude/hooks/state/session.json` |
| Permissions denied | Check settings.json precedence |
| Hook errors | Run test command above to debug |

---

Built for vibe coders who want to ship MCP servers fast! 🚀