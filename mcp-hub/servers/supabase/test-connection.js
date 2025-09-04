#!/usr/bin/env node

/**
 * Test script to verify Supabase MCP server connection
 * Run with: node test-connection.js
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - update these with your values
const config = {
  SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN || 'YOUR_TOKEN_HERE',
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF || 'YOUR_PROJECT_REF_HERE',
};

// Check if credentials are configured
if (config.SUPABASE_ACCESS_TOKEN === 'YOUR_TOKEN_HERE') {
  console.error('❌ Error: Please set your SUPABASE_ACCESS_TOKEN');
  console.error('   Edit this file or set environment variables');
  process.exit(1);
}

if (config.SUPABASE_PROJECT_REF === 'YOUR_PROJECT_REF_HERE') {
  console.error('❌ Error: Please set your SUPABASE_PROJECT_REF');
  console.error('   Edit this file or set environment variables');
  process.exit(1);
}

console.log('🚀 Testing Supabase MCP Server Connection...\n');
console.log(`Project: ${config.SUPABASE_PROJECT_REF}`);
console.log(`Token: ${config.SUPABASE_ACCESS_TOKEN.substring(0, 10)}...`);

// Path to the built server
const serverPath = path.join(__dirname, 'packages', 'mcp-server-supabase', 'dist', 'transports', 'stdio.js');

// Spawn the server process
const server = spawn('node', [serverPath, '--read-only'], {
  env: {
    ...process.env,
    ...config,
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

// Send initialization request
const initRequest = {
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
};

// Send list tools request after initialization
const listToolsRequest = {
  jsonrpc: '2.0',
  method: 'tools/list',
  params: {},
  id: 2
};

let buffer = '';
let initialized = false;

server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Try to parse complete JSON messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        
        if (response.id === 1) {
          console.log('✅ Server initialized successfully!\n');
          initialized = true;
          
          // Send list tools request
          server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
        } else if (response.id === 2) {
          console.log('📦 Available tools:');
          if (response.result && response.result.tools) {
            response.result.tools.forEach(tool => {
              console.log(`  - ${tool.name}: ${tool.description}`);
            });
            console.log('\n✅ Connection test successful!');
          }
          process.exit(0);
        }
      } catch (e) {
        // Not a complete JSON message yet
      }
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

// Send initialization
setTimeout(() => {
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 100);

// Timeout after 10 seconds
setTimeout(() => {
  if (!initialized) {
    console.error('❌ Timeout: Server did not respond');
    server.kill();
    process.exit(1);
  }
}, 10000);