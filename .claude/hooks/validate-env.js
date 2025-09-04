#!/usr/bin/env node

/**
 * Environment Validation Hook
 * Ensures required environment variables are documented when registry is updated
 */

const fs = require('fs');
const path = require('path');

// Read input from Claude
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    validateEnvironment(data);
  } catch (error) {
    process.exit(0);
  }
});

async function validateEnvironment(data) {
  // Check if this is an Edit operation
  if (data.tool_name !== 'Edit') {
    process.exit(0);
    return;
  }
  
  const filePath = data.tool_input?.file_path || '';
  
  // Only check when registry.json is edited
  if (!filePath.endsWith('registry.json')) {
    process.exit(0);
    return;
  }
  
  const projectDir = process.env.CLAUDE_PROJECT_DIR || '.';
  const registryPath = path.join(projectDir, 'mcp-hub', 'hub', 'registry.json');
  const serversDir = path.join(projectDir, 'mcp-hub', 'servers');
  
  try {
    // Load the registry
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const issues = [];
    const suggestions = [];
    
    // Check each server's environment configuration
    for (const [serverName, serverConfig] of Object.entries(registry.servers)) {
      if (serverConfig.requiredEnv && Object.keys(serverConfig.requiredEnv).length > 0) {
        const serverDir = path.join(serversDir, serverName);
        const envExamplePath = path.join(serverDir, '.env.example');
        
        // Check if .env.example exists
        if (!fs.existsSync(envExamplePath)) {
          issues.push(`${serverName}: Missing .env.example file`);
          
          // Generate .env.example content
          const envExampleContent = Object.entries(serverConfig.requiredEnv)
            .map(([key, config]) => {
              const comment = config.description ? `# ${config.description}` : '';
              const placeholder = config.sensitive ? 'your-secret-here' : 'your-value-here';
              return `${comment}\n${key}=${placeholder}`;
            })
            .join('\n\n');
          
          suggestions.push(`Create ${serverName}/.env.example with:
${envExampleContent}`);
        } else {
          // Check if .env.example contains all required vars
          const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
          const missingVars = [];
          
          for (const envVar of Object.keys(serverConfig.requiredEnv)) {
            if (!envExampleContent.includes(envVar)) {
              missingVars.push(envVar);
            }
          }
          
          if (missingVars.length > 0) {
            issues.push(`${serverName}: .env.example missing variables: ${missingVars.join(', ')}`);
            suggestions.push(`Add missing variables to ${serverName}/.env.example`);
          }
        }
        
        // Validate environment variable configuration
        for (const [key, config] of Object.entries(serverConfig.requiredEnv)) {
          // Check for proper description
          if (!config.description || config.description === '') {
            issues.push(`${serverName}: ${key} missing description`);
            suggestions.push(`Add description for ${key} in registry.json`);
          }
          
          // Check sensitive flag for common secret patterns
          const secretPatterns = ['TOKEN', 'KEY', 'SECRET', 'PASSWORD', 'CREDENTIAL'];
          const shouldBeSensitive = secretPatterns.some(pattern => key.includes(pattern));
          
          if (shouldBeSensitive && !config.sensitive) {
            issues.push(`${serverName}: ${key} should be marked as sensitive`);
            suggestions.push(`Set "sensitive": true for ${key} in registry.json`);
          }
          
          // Check required flag
          if (config.required === undefined) {
            issues.push(`${serverName}: ${key} missing 'required' flag`);
            suggestions.push(`Add "required": true/false for ${key} in registry.json`);
          }
        }
      }
      
      // Check if server has .env.example but no requiredEnv in registry
      const serverDir = path.join(serversDir, serverName);
      const envExamplePath = path.join(serverDir, '.env.example');
      
      if (fs.existsSync(envExamplePath) && (!serverConfig.requiredEnv || Object.keys(serverConfig.requiredEnv).length === 0)) {
        const envContent = fs.readFileSync(envExamplePath, 'utf8');
        const envVars = envContent.match(/^[A-Z_]+(?==)/gm);
        
        if (envVars && envVars.length > 0) {
          issues.push(`${serverName}: Has .env.example but no requiredEnv in registry`);
          suggestions.push(`Add requiredEnv configuration for: ${envVars.join(', ')}`);
        }
      }
    }
    
    // Also check mcp-hub/.env.example for hub-level variables
    const hubEnvExamplePath = path.join(projectDir, 'mcp-hub', '.env.example');
    if (fs.existsSync(hubEnvExamplePath)) {
      const hubEnvContent = fs.readFileSync(hubEnvExamplePath, 'utf8');
      
      // Check if all servers' required env vars are documented in hub .env.example
      for (const [serverName, serverConfig] of Object.entries(registry.servers)) {
        if (serverConfig.requiredEnv) {
          for (const envVar of Object.keys(serverConfig.requiredEnv)) {
            if (!hubEnvContent.includes(envVar)) {
              suggestions.push(`Consider adding ${envVar} to mcp-hub/.env.example for centralized management`);
            }
          }
        }
      }
    }
    
    // Prepare response
    if (issues.length > 0) {
      const message = `
🔐 Environment Configuration Validation

Issues found:
${issues.map(i => `  ❌ ${i}`).join('\n')}

Suggestions:
${suggestions.map(s => `  💡 ${s}`).join('\n')}

Best practices:
- Always create .env.example with placeholders
- Mark sensitive variables (tokens, keys, passwords) with sensitive: true
- Provide clear descriptions for each variable
- Document all required environment variables in registry.json
`;
      
      // Provide feedback to Claude about env issues
      console.log(JSON.stringify({
        decision: "block",
        reason: message
      }));
      process.exit(0);
    } else {
      // All good - exit cleanly
      process.exit(0);
    }
    
  } catch (error) {
    // Registry might be malformed during editing
    process.exit(0);
  }
}