#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hubRoot = path.resolve(__dirname, '../..');

// Load environment
dotenv.config({ path: path.join(hubRoot, '.env') });

/**
 * Mask sensitive values for display
 */
const maskValue = (key, value) => {
  if (!value) return '(not set)';
  
  const sensitiveKeys = ['TOKEN', 'KEY', 'SECRET', 'PASSWORD', 'PASS'];
  const isSensitive = sensitiveKeys.some(k => key.toUpperCase().includes(k));
  
  if (isSensitive) {
    return value.length > 6 ? value.substring(0, 6) + '***' : '***';
  }
  return value;
};

/**
 * Show current environment variables
 */
const showEnvironment = async () => {
  console.log(chalk.cyan('\n📋 MCP Hub Environment Variables\n'));
  
  // Load registry to know which vars to check
  const registryPath = path.join(hubRoot, 'hub', 'registry.json');
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
  
  // Group by server
  for (const [serverName, server] of Object.entries(registry.servers)) {
    const envVars = server.requiredEnv || {};
    if (Object.keys(envVars).length === 0) continue;
    
    console.log(chalk.bold(`\n${server.name}:`));
    
    for (const [key, config] of Object.entries(envVars)) {
      const value = process.env[key];
      const masked = maskValue(key, value);
      const status = value ? chalk.green('✓') : chalk.red('✗');
      
      console.log(`  ${status} ${key}: ${masked}`);
      if (!value && config.description) {
        console.log(chalk.gray(`    → ${config.description}`));
      }
    }
  }
  
  // Show hub configuration
  console.log(chalk.bold('\nHub Configuration:'));
  const hubVars = [
    'MCP_HUB_AUTO_INSTALL',
    'MCP_HUB_AUTO_BUILD',
    'MCP_HUB_DEFAULT_READ_ONLY',
    'MCP_HUB_TIMEOUT',
    'MCP_HUB_LOG_LEVEL'
  ];
  
  for (const key of hubVars) {
    const value = process.env[key];
    const status = value ? chalk.green('✓') : chalk.gray('○');
    console.log(`  ${status} ${key}: ${value || '(default)'}`);
  }
};

/**
 * Initialize .env from .env.example
 */
const initEnvironment = async () => {
  const envPath = path.join(hubRoot, '.env');
  const examplePath = path.join(hubRoot, '.env.example');
  
  // Check if .env already exists
  try {
    await fs.access(envPath);
    console.log(chalk.yellow('\n⚠️  .env file already exists!'));
    console.log('To reinitialize, delete or rename the existing .env file first.');
    return;
  } catch {
    // .env doesn't exist, continue
  }
  
  // Copy .env.example to .env
  try {
    const content = await fs.readFile(examplePath, 'utf-8');
    await fs.writeFile(envPath, content, 'utf-8');
    console.log(chalk.green('\n✅ Created .env file from .env.example'));
    console.log(chalk.yellow('\n📝 Next steps:'));
    console.log('1. Edit .env and add your credentials');
    console.log('2. Run "npm run mcp:env" to verify configuration');
    console.log('3. Run "npm run mcp" to launch servers');
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to create .env: ${error.message}`));
  }
};

/**
 * Validate environment variables
 */
const validateEnvironment = async () => {
  console.log(chalk.cyan('\n🔍 Validating Environment Variables\n'));
  
  const registryPath = path.join(hubRoot, 'hub', 'registry.json');
  const registry = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
  
  let hasErrors = false;
  
  for (const [serverName, server] of Object.entries(registry.servers)) {
    const envVars = server.requiredEnv || {};
    if (Object.keys(envVars).length === 0) continue;
    
    console.log(chalk.bold(`${server.name}:`));
    
    let serverValid = true;
    for (const [key, config] of Object.entries(envVars)) {
      const value = process.env[key];
      
      if (!value && config.required) {
        console.log(chalk.red(`  ✗ ${key}: Missing required variable`));
        serverValid = false;
        hasErrors = true;
      } else if (value) {
        // Basic validation
        if (key === 'SUPABASE_ACCESS_TOKEN' && !value.startsWith('sbp_')) {
          console.log(chalk.yellow(`  ⚠️  ${key}: Should start with 'sbp_'`));
        } else if (key === 'GITHUB_TOKEN' && !value.startsWith('ghp_')) {
          console.log(chalk.yellow(`  ⚠️  ${key}: Should start with 'ghp_'`));
        } else if (key === 'OPENAI_API_KEY' && !value.startsWith('sk-')) {
          console.log(chalk.yellow(`  ⚠️  ${key}: Should start with 'sk-'`));
        } else {
          console.log(chalk.green(`  ✓ ${key}: Valid`));
        }
      } else {
        console.log(chalk.gray(`  ○ ${key}: Optional, not set`));
      }
    }
    
    if (serverValid && Object.keys(envVars).length > 0) {
      console.log(chalk.green(`  → ${serverName} is ready to use`));
    } else if (!serverValid) {
      console.log(chalk.red(`  → ${serverName} is missing required variables`));
    }
    console.log();
  }
  
  if (hasErrors) {
    console.log(chalk.red('❌ Some servers have missing required variables'));
    console.log(chalk.yellow('Edit .env to add the missing credentials'));
  } else {
    console.log(chalk.green('✅ All configured servers are ready to use!'));
  }
};

// Main CLI
const main = async () => {
  const command = process.argv[2];
  
  switch (command) {
    case 'show':
      await showEnvironment();
      break;
      
    case 'init':
      await initEnvironment();
      break;
      
    case 'validate':
      await validateEnvironment();
      break;
      
    default:
      console.log(chalk.cyan('\nMCP Hub Environment Manager\n'));
      console.log('Usage:');
      console.log('  npm run mcp:env         - Show current environment');
      console.log('  npm run mcp:env:init    - Create .env from template');
      console.log('  npm run mcp:env:validate - Validate credentials');
  }
};

main().catch(error => {
  console.error(chalk.red(`\n❌ Error: ${error.message}`));
  process.exit(1);
});