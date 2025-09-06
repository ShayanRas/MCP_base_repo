# MCP Seed Repository

⚠️ **PROPRIETARY SOFTWARE - RESTRICTED ACCESS** ⚠️

This repository contains proprietary code. Access is granted ONLY to paid subscribers. All code must remain within this repository. See [LICENSE](LICENSE) for full terms.

---

This MCP Seed Repo will allow you to use AI Coding agents such as Claude Code, Gemini CLI and OpenAI's Codex, as well as AI IDEs such as Cursor or Windsurf, to create and run ANY MCP server and toolkit you'd like to build.

## Quick Start

**Windows:**
```bash
git clone https://github.com/your-repo/mcp-seed
cd mcp-seed
START_HERE.bat
```

**Mac/Linux:**
```bash
git clone https://github.com/your-repo/mcp-seed
cd mcp-seed
./START_HERE.sh
```

That's it. The script will install everything and launch the MCP Hub menu.

## How Does It Work?

I've prepared the repo in two main sections:
1) **The MCP Management and Debug Hub** (mcp-hub) - Your control center for building and testing MCP servers
2) **The Knowledge Base** - Everything your AI needs to know about building MCPs

## The MCP Hub

### What is it?

It's a simple menu system that handles all the annoying parts of MCP development. Install dependencies, test connections, generate Claude Desktop configs - all from one place. No more fumbling with config files or wondering why your server won't connect.

The hub comes with three example servers ready to go:
- **Everything** - Shows off all MCP features (good for learning)
- **Supabase** - Connect to your Supabase databases
- **pg_tools** - Direct PostgreSQL access

### Features That Actually Matter

- **One-click setup** - Installs Node, Python, UV, everything you need
- **Debug mode** - When things break (they will), run with `--debug` to see what's happening
- **Inspector built-in** - Test your MCP tools without leaving the terminal
- **Auto-config for Claude** - Generates and installs configs automatically

## Building Your Own MCP

### With Claude Code (Recommended)

Claude Code will produce the best result, most consistently. I've prepared an in-depth CLAUDE.md that allows the agent to act as needed for easy but reliable MCP development.

Just open this repo in Claude Code and type: **"let's start building"**

Claude will:
1. Review the MCP knowledge base
2. Ask what you want to build
3. Create a proper MCP server structure
4. Integrate it with the hub automatically

### Manual Development

1. Create your server in `mcp-hub/servers/your-server-name/`
2. Add it to `mcp-hub/hub/registry.json`
3. Run `npm run mcp` from the mcp-hub directory
4. Select your server and test it

## The Knowledge Base

Located in `/Reference/Knowledge/`, it contains:
- `mcp_intro_and_base_knowledge.md` - Core MCP concepts
- `mcp_practical_server_guide.md` - Step-by-step implementation guide
- Example servers and patterns

## Prompt Pack

The repo includes a Prompt Pack (`Reference/prompt_pack.md`) to help you with any phase of the development process. Use these when you get stuck or need to debug something tricky.

## Requirements

- Node.js 18+
- Python 3.10+ (for Python-based servers)
- Git (recommended)

The START_HERE scripts will check for these and guide you through installation if needed.

## Troubleshooting

**Script won't run on Mac/Linux:**
```bash
chmod +x START_HERE.sh
./START_HERE.sh
```

**Debug mode for when things go wrong:**
```bash
# Windows
START_HERE.bat --debug

# Mac/Linux
./START_HERE.sh --debug
```

**Server won't connect:**
Check the `.env` file in mcp-hub and make sure your API keys are set.

## What's an MCP Anyway?

MCP (Model Context Protocol) is how AI apps like Claude connect to external tools and data. Think of it as giving your AI superpowers - database access, file manipulation, web scraping, whatever you need.

Instead of every AI app building custom integrations, MCP provides a standard way to expose capabilities that any MCP-compatible client can use.

## Next Steps

1. Run the START_HERE script
2. Play with the example servers
3. Build something cool
4. Share it with the community

That's it. Stop reading and start building.