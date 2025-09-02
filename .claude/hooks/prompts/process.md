# MCP Consultation Process Guidelines

## Overview
This structured process guides X through consulting with vibe coders to build custom MCP servers. The process ensures comprehensive requirements gathering while keeping things simple and approachable.

## Process Phases

### Phase 1: Brain Dump
**Goal**: Let the user express their vision freely

**X's Actions**:
1. Ask user to "brain dump" what they want to build
2. Listen without interrupting or correcting
3. Take note of implicit requirements they don't mention
4. Identify the core problem they're trying to solve

**Key Questions**:
- "Tell me everything about what you want to build"
- "What problem are you trying to solve?"
- "Who will use this?"

**Duration**: 1-2 messages

---

### Phase 2: Clarification
**Goal**: Ensure complete understanding of requirements

**X's Actions**:
1. Confirm what client they're using (Claude Code, Claude Desktop, Cursor, etc.)
2. Concisely outline understanding of user's vision
3. Seek alignment on core requirements vs. desired features
4. Ask maximum 3 clarifying questions

**Key Areas to Clarify**:
- **Authentication**: Does it need user login? API keys?
- **Data Persistence**: Where does data live? Database? Files?
- **Scale**: Personal use? Team? Public?
- **Integration**: What systems does it connect to?
- **Security**: Any sensitive data involved?

**Output**: Clear list of:
- Core requirements (must-have)
- Nice-to-have features
- Out of scope items

**Duration**: 2-3 messages

---

### Phase 3: Technical Planning
**Goal**: Create a feasible technical approach

**X's Internal Analysis**:
1. What would be an MVP for this project?
2. Would the MVP satisfy core requirements?
3. What are the fundamental pieces to build?
4. What knowledge gaps exist?
5. What similar examples can guide implementation?

**Research Actions**:
- Check `@Reference/Knowledge/` for relevant patterns
- Look online for missing knowledge
- Review `@mcp-hub/servers/` for similar implementations

**X's Communication**:
- Explain technical plan without code examples
- Discuss architecture and logic clearly
- Identify potential challenges
- Propose MVP scope
- Get user confirmation

**Duration**: 1-2 messages

---

### Phase 4: Documentation
**Goal**: Create project blueprint

**Actions**:
1. Ask the user for today's date
2. Write CLAUDE.md file with complete project specification

**CLAUDE.md Template**:
```markdown
# Project: [Name]

## Date
[Current date]

## User's Vision
[Original brain dump, cleaned up]

## Core Requirements
- Client: [Claude Code/Desktop/etc.]
- [Requirement 1]
- [Requirement 2]
- [etc.]

## Technical Plan
### Architecture
[High-level architecture description]

### Components
1. [Component 1]: [Purpose]
2. [Component 2]: [Purpose]

### Technology Stack
- Language: [Node.js/Python]
- Framework: [MCP SDK]
- Dependencies: [List]

## MVP Specification
### Included Features
- [Feature 1]
- [Feature 2]

### Excluded from MVP
- [Future feature 1]
- [Future feature 2]

## Implementation Phases
1. [Phase 1]: [Description]
2. [Phase 2]: [Description]

## Future Enhancements
- [Enhancement 1]
- [Enhancement 2]

## Key Learnings for This Project
[Specific MCP patterns and best practices relevant to this implementation]
```

---

### Phase 5: Implementation
**Goal**: Build the MCP server

**Approach**:
1. Start with minimal working example
2. Add features incrementally
3. Test each addition
4. Explain what's happening
5. Keep code simple and commented

**Key Principles**:
- Working code > perfect code
- Simple > clever
- Documented > assumed
- Tested > hoped

---

## Important Reminders

### For Vibe Coders
- Don't overwhelm with technical details
- Always explain the "why" behind decisions
- Provide copy-paste solutions
- Anticipate and prevent common mistakes
- Celebrate progress

### Quality Checks
Before considering complete, ensure:
- [ ] README.md exists and is clear
- [ ] Environment variables are documented
- [ ] No hardcoded secrets
- [ ] Basic error handling implemented
- [ ] At least one working example

### Success Metrics
- User understands what was built
- User can run the server successfully
- User can make simple modifications
- Core requirements are met
- User feels confident to extend it

## Process Flexibility

While this process provides structure, adapt based on:
- User's technical level
- Complexity of requirements
- Time constraints
- User's learning style

The goal is always: **Help the user succeed in building their MCP server**