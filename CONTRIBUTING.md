# Contributing

⚠️ **IMPORTANT: This is PROPRIETARY SOFTWARE** ⚠️

By contributing, you agree that all contributions become property of Shayan Rastgou. See [LICENSE](LICENSE) for details.

Want to help make this better? Here's how.

## Quick Start

1. Fork the repo (within the allowed environment only)
2. Make your changes
3. Test them (seriously, test them)
4. Submit a PR with a clear description

**REMEMBER**: All work must remain within this repository. No external usage allowed.

## What We Need Help With

- **New MCP servers** - Build something cool and add it to the hub
- **Bug fixes** - Find something broken? Fix it
- **Documentation** - Make things clearer for the next person
- **Better examples** - Show people what's possible

## Legal Notice

By submitting a contribution:
- You transfer all rights to Shayan Rastgou
- Your code becomes part of this proprietary software
- You cannot use the contributed code outside this repository
- You must have an active subscription to contribute

## Adding a New MCP Server

If you've built an MCP server:

1. Add it to `mcp-hub/servers/your-server-name/`
2. Update `mcp-hub/hub/registry.json` with your server config
3. Include a README explaining what it does and how to use it
4. Make sure it works with the hub's setup process
5. Remember: The server becomes property of this repository

## Code Style

Don't overthink it. Just:
- Make it work
- Make it readable
- Add comments where things get weird
- Test before you commit

## Testing

Before submitting:
```bash
cd mcp-hub
npm run mcp
# Test your changes through the menu
```

If you added a server, make sure:
- Setup works
- Test connection succeeds
- Config generation works

## Submitting PRs

Keep your PR description simple:
- What problem does this solve?
- How did you solve it?
- Anything special we should know?
- Confirm you agree to the license terms

## Questions?

Open an issue. We're here to help.

## Code of Conduct

Be cool. Help others. Don't be a jerk.
Respect the proprietary nature of this software.

That's it. Thanks for contributing!