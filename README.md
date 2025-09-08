# SR's MCP Seed Repo
This repo is desigend for vibe coders and semi-technical users looking to build their own MPC servers and custom tools with AI Agents.

With this package, wich includes the required knowledge base and infrastructure, you can use AI Coding agents such as Claude Code, Gemini CLI and OpenAI's Codex, as well as AI IDEs such as Cursor or Windsurf, to create and run ANY MCP server and toolkit you'd like to build.

I've taken care of all the complexities of MCP development, including installing, debugging, running and adding them to Claude Desktop automatically. All you have to do is clone the repo, run the START_HERE script and follow the prompts. It also include a prepared CLAUDE.md (or IDE memory file) to tune your AI coding agent perfectly to build and extend MCPs.

## Package Includes:
- MCP Hub (mcp-hub)
- MCP Knowledge Base
- Example Servers
- My highly saught after Text to SQL Server
- MCP Inspector
- Prompt Pack for Vibe Software Engineering gathered from my experience building a six figure business with AI Agents
- Preapred CLAUDE.md (or IDE memory file)

**Best Practices to make MCP development easier:**
1. Always use Github Desktop to track and manage changes to your code. Install Github from here: [Click here](https://desktop.github.com/download/)
2. If you're using windows, install WSL. follow [this link](https://learn.microsoft.com/en-us/windows/wsl/install) to learn how to. 
3. I've already trained the AI to walk you through this when needed, but be prepared to run important tests like "npm run build, npx tsc" etc. yourself


## Getting Started

**Windows:**
Open your terminal in the project root and run:
```Powershell
./START_HERE.bat
```
```Bash (WSL)
./START_HERE.sh
```
**Mac/Linux:**
```bash
./START_HERE.sh
```

That's it. The script will install everything and launch the MCP Hub menu.

### Running MCP Hub After Setup

Once setup is complete, you can launch the MCP Hub directly from the root:

**Windows:**
```Powershell
MCP.bat
```

**Mac/Linux/WSL:**
```Bash
./MCP.sh
```


## How Does It Work?

I've prepared the repo in two main sections:
1) **The MCP Management and Debug Hub** (mcp-hub) - Your control center for building and testing MCP servers, as well as launching Inspector for debugging tools.

2) **The Knowledge Base** - Everything your AI needs to know about building MCPs. Run your AI with this KB and the prompt pack provided to build and extend MCPs as you like.

## The MCP Hub

### What is it?

It's a simple menu system that handles all the annoying parts of MCP development. Install dependencies, test connections, generate Claude Desktop configs - all from one place. No more fumbling with config files or wondering why your server won't connect.

The hub comes with three example servers ready to go:
- **Everything** - Shows off all MCP features (good for learning)
- **Supabase** - Connect to your Supabase databases
- **My highly saught after Text to SQL Toolkit** - Direct PostgreSQL access both local and remote.

### Features
- **One-click setup** - Installs Node, Python, UV, everything you need
- **Debug mode** - When things break (they will), run with `--debug` to see what's happening
- **Inspector built-in** - Test your MCP tools without leaving the terminal
- **Auto-config for Claude** - Generates and installs configs automatically




# Building Your Own MCP

### With Claude Code (Recommended)

Claude Code will produce the best result, most consistently. I've prepared an in-depth CLAUDE.md that allows the agent to act as needed for easy but reliable MCP development.

Just open this repo in Claude Code and type: **"let's start building"**

Claude will:
1. Review the MCP knowledge base I've prepared in the right order
2. Ask what you want to build
3. Create a proper MCP server structure
4. Integrate it with the hub automatically

## Prompt Pack
This is my personally tailored prompt pack that's helped me build and run a six figure business with with the help of AI Agents. Prompts are specifically optimized by me to be as effective as possible. Each prompt has a appropriate timing and way of use, that's laid out in the prompt pack. 

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
./START_HERE.bat --debug

# Mac/Linux
./START_HERE.sh --debug
```

**Server won't connect:**
Check the `.env` file in mcp-hub and make sure your API keys are set.

## Next Steps

1. Run the START_HERE script
2. Play with the example servers
3. Build something cool
4. Share it with the community

That's it. Stop reading and start building.