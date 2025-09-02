#!/usr/bin/env node

/**
 * MCP Brainstorming Hook
 * Automatically activates X consultant mode when user wants to brainstorm
 */

const fs = require('fs');
const path = require('path');

// Configuration
const STATE_FILE = path.join(__dirname, 'state', 'session.json');
const PERSONA_FILE = path.join(__dirname, 'prompts', 'x-persona.md');
const PROCESS_FILE = path.join(__dirname, 'prompts', 'process.md');

// Brainstorming trigger phrases
const TRIGGERS = [
  /^begin\s+brainstorm(?:ing)?/i,
  /^start\s+brainstorm(?:ing)?/i,
  /^let'?s\s+brainstorm/i,
  /^help\s+me\s+brainstorm/i,
  /^brainstorm\s+(?:an?\s+)?mcp/i,
  /^i\s+want\s+to\s+build\s+an?\s+mcp/i,
  /^create\s+(?:an?\s+)?mcp\s+server/i
];

// Consultation phases
const PHASES = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  BRAIN_DUMP: 'brain_dump',
  CLARIFICATION: 'clarification',
  PLANNING: 'planning',
  IMPLEMENTATION: 'implementation'
};

// Read input from Claude
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    processHook(data);
  } catch (error) {
    // If there's an error, don't block - just pass through
    console.log(JSON.stringify({ blocked: false }));
  }
});

function processHook(data) {
  // Check if this is a brainstorming trigger
  const userMessage = data.userMessage || data.prompt || '';
  const isTrigger = TRIGGERS.some(pattern => userMessage.match(pattern));
  
  // Load or initialize state
  const state = loadState();
  
  // Handle based on current state and trigger
  if (isTrigger && state.phase === PHASES.IDLE) {
    // New brainstorming session
    initializeBrainstorming(userMessage, state);
  } else if (state.phase !== PHASES.IDLE) {
    // Continue existing session
    continueSession(userMessage, state);
  } else {
    // Not a brainstorming session
    console.log(JSON.stringify({ blocked: false }));
  }
}

function initializeBrainstorming(userMessage, state) {
  // Update state
  state.phase = PHASES.INITIALIZING;
  state.startTime = Date.now();
  state.messageCount = 0;
  saveState(state);
  
  // Load prompts
  const persona = loadPrompt(PERSONA_FILE);
  const process = loadPrompt(PROCESS_FILE);
  
  // Build enhanced prompt
  const enhancedPrompt = `
${userMessage}

[MCP BRAINSTORMING MODE ACTIVATED]

${persona}

You have access to the following knowledge resources:
- @Reference/Knowledge/mcp_intro_and_base_knowledge.md - Comprehensive MCP fundamentals
- @Reference/Knowledge/mcp_practical_server_guide.md - Practical implementation guide
- @mcp-hub/servers/everything/ - Full-featured example server

Please review these resources to become certified as an MCP expert, then begin the consultation process.

${process}

Current Phase: INITIALIZATION
Next Step: Review knowledge base, then ask the user to brain dump their idea.

Remember: You are working with a vibe coder who may not understand technical details. Be patient, clear, and guide them step by step.
`;
  
  // Return enhanced prompt
  console.log(JSON.stringify({
    blocked: false,
    enhancedPrompt: enhancedPrompt,
    metadata: {
      hookActivated: true,
      phase: PHASES.INITIALIZING,
      mode: 'mcp_consultation'
    }
  }));
}

function continueSession(userMessage, state) {
  state.messageCount++;
  
  // Determine phase transitions
  if (state.phase === PHASES.INITIALIZING && state.messageCount > 1) {
    state.phase = PHASES.BRAIN_DUMP;
  } else if (state.phase === PHASES.BRAIN_DUMP && state.messageCount > 3) {
    state.phase = PHASES.CLARIFICATION;
  } else if (state.phase === PHASES.CLARIFICATION && state.messageCount > 6) {
    state.phase = PHASES.PLANNING;
  } else if (state.phase === PHASES.PLANNING && userMessage.toLowerCase().includes('approved')) {
    state.phase = PHASES.IMPLEMENTATION;
  }
  
  saveState(state);
  
  // Build phase-specific guidance
  const phaseGuidance = getPhaseGuidance(state.phase);
  
  const enhancedPrompt = `
${userMessage}

[CONSULTATION CONTEXT]
Phase: ${state.phase}
Messages in session: ${state.messageCount}

${phaseGuidance}
`;
  
  console.log(JSON.stringify({
    blocked: false,
    enhancedPrompt: enhancedPrompt,
    metadata: {
      hookActive: true,
      phase: state.phase,
      messageCount: state.messageCount
    }
  }));
}

function getPhaseGuidance(phase) {
  switch (phase) {
    case PHASES.BRAIN_DUMP:
      return `
[BRAIN DUMP PHASE]
- Listen to the user's idea without judgment
- Ask for more details about their vision
- Don't get technical yet
- Maximum 3 clarifying questions
- Focus on understanding their goal`;
      
    case PHASES.CLARIFICATION:
      return `
[CLARIFICATION PHASE]
- Confirm your understanding of their vision
- Identify core requirements vs nice-to-haves
- Ask about: client type, expected users, data needs
- Check for missing requirements (auth, persistence, security)
- Be concise and clear`;
      
    case PHASES.PLANNING:
      return `
[PLANNING PHASE]
- Define the MVP scope
- Explain technical approach in simple terms
- Identify fundamental components
- Check knowledge gaps and research if needed
- Get user approval before proceeding`;
      
    case PHASES.IMPLEMENTATION:
      return `
[IMPLEMENTATION PHASE]
- Start building the MCP server
- Explain what you're doing as you go
- Create CLAUDE.md with project details
- Focus on working MVP first
- Keep code simple and well-commented`;
      
    default:
      return '';
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      
      // Reset if session is too old (24 hours)
      if (Date.now() - state.startTime > 24 * 60 * 60 * 1000) {
        return { phase: PHASES.IDLE };
      }
      
      return state;
    }
  } catch (error) {
    // If state is corrupted, start fresh
  }
  
  return { phase: PHASES.IDLE };
}

function saveState(state) {
  try {
    // Ensure state directory exists
    const stateDir = path.dirname(STATE_FILE);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    // State saving is non-critical, continue anyway
  }
}

function loadPrompt(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (error) {
    // If prompt file doesn't exist, use embedded version
  }
  
  // Return embedded prompts if files don't exist
  if (filePath.includes('x-persona')) {
    return `
You are X. X is a senior software engineer and full stack developer who loves to approach problems fundamentally and methodically. 

X's expertise:
- Deep understanding of MCP (Model Context Protocol)
- Full-stack development across multiple languages
- System architecture and design patterns
- Teaching complex concepts to non-technical users

X's approach:
- Patient and encouraging with vibe coders
- Explains technical concepts in simple terms
- Focuses on practical, working solutions
- Guides through best practices naturally
`;
  }
  
  if (filePath.includes('process')) {
    return `
CONSULTATION PROCESS:

1. Brain Dump Phase
   - Let user describe their idea freely
   - Ask maximum 3 clarifying questions
   - Focus on understanding their vision

2. Clarification Phase
   - Confirm understanding of requirements
   - Identify core vs nice-to-have features
   - Check for missing technical requirements

3. Planning Phase
   - Define MVP scope
   - Explain technical approach
   - Get user approval

4. Implementation Phase
   - Build working MCP server
   - Create documentation
   - Ensure production readiness
`;
  }
  
  return '';
}