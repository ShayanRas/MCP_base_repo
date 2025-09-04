#!/usr/bin/env node

/**
 * Test helper for Supabase MCP Server
 * Run from supabase root directory: node test-mcp.js
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for environment variables
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

console.log('🧪 Supabase MCP Server Test\n');
console.log('Current directory:', process.cwd());
console.log('Script directory:', __dirname);

if (!token || !projectRef) {
  console.error('❌ Missing environment variables!');
  console.error('\nPlease set:');
  console.error('  SUPABASE_ACCESS_TOKEN=your_token');
  console.error('  SUPABASE_PROJECT_REF=your_project_ref');
  console.error('\nOr create a .env file in mcp-hub/ with these values.');
  process.exit(1);
}

console.log('\n✅ Environment variables found:');
console.log(`  Token: ${token.substring(0, 10)}...`);
console.log(`  Project: ${projectRef}`);

// Path to the stdio server (relative from supabase root)
const serverPath = 'packages/mcp-server-supabase/dist/transports/stdio.js';

console.log('\n🚀 Starting server...');
console.log(`  Command: node ${serverPath}`);
console.log('  Working directory:', __dirname);

const child = spawn('node', [serverPath], {
  cwd: __dirname,  // Run from supabase root directory
  env: {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: token,
    SUPABASE_PROJECT_REF: projectRef
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send initialization request
const initRequest = JSON.stringify({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  },
  id: 1
}) + '\n';

let responseBuffer = '';
let errorBuffer = '';

child.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  // Try to parse complete JSON messages
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        
        if (response.id === 1) {
          console.log('\n✅ Server initialized successfully!');
          console.log('\nServer info:');
          if (response.result?.serverInfo) {
            console.log(`  Name: ${response.result.serverInfo.name}`);
            console.log(`  Version: ${response.result.serverInfo.version}`);
          }
          if (response.result?.capabilities) {
            console.log(`  Capabilities: ${Object.keys(response.result.capabilities).join(', ')}`);
          }
          
          // Send list tools request
          const listToolsRequest = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
            id: 2
          }) + '\n';
          
          child.stdin.write(listToolsRequest);
        } else if (response.id === 2) {
          console.log('\n📦 Available tools:');
          if (response.result?.tools) {
            response.result.tools.slice(0, 5).forEach(tool => {
              console.log(`  - ${tool.name}: ${tool.description}`);
            });
            if (response.result.tools.length > 5) {
              console.log(`  ... and ${response.result.tools.length - 5} more`);
            }
          }
          
          console.log('\n✅ All tests passed! Server is working correctly.');
          console.log('\n💡 You can now use this server with Claude Desktop.');
          child.kill();
          process.exit(0);
        }
      } catch (e) {
        // Not a complete JSON message yet
      }
    }
  }
});

child.stderr.on('data', (data) => {
  errorBuffer += data.toString();
});

child.on('error', (error) => {
  console.error('\n❌ Failed to start server:', error.message);
  console.error('\nMake sure you:');
  console.error('1. Run this from the supabase directory');
  console.error('2. Have built the server (pnpm build)');
  console.error('3. Have installed dependencies (pnpm install)');
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error('\n❌ Server exited with error code:', code);
    if (errorBuffer) {
      console.error('\nError output:', errorBuffer);
    }
    process.exit(1);
  }
});

// Send initialization after a short delay
setTimeout(() => {
  console.log('\n📤 Sending initialization request...');
  child.stdin.write(initRequest);
}, 500);

// Timeout after 10 seconds
setTimeout(() => {
  console.error('\n⏱️  Timeout: Server did not respond within 10 seconds');
  console.error('\nPossible issues:');
  console.error('1. Invalid credentials');
  console.error('2. Network connectivity');
  console.error('3. Server build issues');
  
  if (errorBuffer) {
    console.error('\nError output:', errorBuffer);
  }
  
  child.kill();
  process.exit(1);
}, 10000);