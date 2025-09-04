#!/usr/bin/env node

/**
 * Test script to verify hooks are working correctly
 */

const { spawn } = require('child_process');
const path = require('path');

// Test data for different hook types
const testCases = {
  UserPromptSubmit: {
    hook: 'brainstorm.js',
    input: {
      session_id: "test-123",
      transcript_path: "/tmp/test.jsonl",
      cwd: process.cwd(),
      hook_event_name: "UserPromptSubmit",
      prompt: "help me brainstorm an MCP server"
    }
  },
  
  PreToolUse_Bash: {
    hook: 'manual-build-guide.js',
    input: {
      session_id: "test-123",
      transcript_path: "/tmp/test.jsonl",
      cwd: process.cwd(),
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {
        command: "npm run build"
      }
    }
  },
  
  PostToolUse_Write: {
    hook: 'validate-server-structure.js',
    input: {
      session_id: "test-123",
      transcript_path: "/tmp/test.jsonl",
      cwd: process.cwd(),
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: {
        file_path: "/mnt/c/Users/Shayan/Github_projects/MCP_base_repo/mcp-hub/servers/test-server/package.json",
        content: '{"name": "test-server"}'
      },
      tool_response: {
        filePath: "/mnt/c/Users/Shayan/Github_projects/MCP_base_repo/mcp-hub/servers/test-server/package.json",
        success: true
      }
    }
  },
  
  PostToolUse_Edit: {
    hook: 'validate-env.js',
    input: {
      session_id: "test-123",
      transcript_path: "/tmp/test.jsonl", 
      cwd: process.cwd(),
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: {
        file_path: "/mnt/c/Users/Shayan/Github_projects/MCP_base_repo/mcp-hub/hub/registry.json",
        old_string: "test",
        new_string: "test2"
      },
      tool_response: {
        success: true
      }
    }
  }
};

async function testHook(name, testCase) {
  console.log(`\n=== Testing ${name} ===`);
  console.log(`Hook: ${testCase.hook}`);
  console.log(`Input:`, JSON.stringify(testCase.input, null, 2));
  
  return new Promise((resolve) => {
    const hookPath = path.join(__dirname, testCase.hook);
    const child = spawn('node', [hookPath], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(`Exit code: ${code}`);
      
      if (stdout) {
        console.log('Output:', stdout);
        try {
          const parsed = JSON.parse(stdout);
          console.log('Parsed JSON:', parsed);
        } catch (e) {
          // Not JSON output
        }
      }
      
      if (stderr) {
        console.log('Stderr:', stderr);
      }
      
      console.log('---');
      resolve();
    });
    
    // Send the test input
    child.stdin.write(JSON.stringify(testCase.input));
    child.stdin.end();
  });
}

async function runTests() {
  console.log('Starting hook tests...\n');
  console.log('Environment: CLAUDE_PROJECT_DIR =', process.cwd());
  
  for (const [name, testCase] of Object.entries(testCases)) {
    await testHook(name, testCase);
  }
  
  console.log('\nAll tests completed!');
}

runTests().catch(console.error);