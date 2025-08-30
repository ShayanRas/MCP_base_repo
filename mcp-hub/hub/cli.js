#!/usr/bin/env node

import { MCPHubManager } from './manager.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { program } from 'commander';

const manager = new MCPHubManager();

// ASCII Art Header
const showHeader = () => {
  console.log(chalk.cyan(`
╔═══════════════════════════════════╗
║       MCP Hub Manager v1.0        ║
║   Manage Your MCP Servers Easily  ║
╚═══════════════════════════════════╝
  `));
};

// Show server status
const showServerStatus = async (serverName) => {
  const spinner = ora(`Checking ${serverName} status...`).start();
  
  try {
    const status = await manager.getServerStatus(serverName);
    spinner.stop();
    
    console.log(chalk.bold(`\n📦 ${status.name}`));
    console.log(`   Status: ${status.ready ? chalk.green('✅ Ready') : 
                  status.installed ? chalk.yellow('⚠️  Needs build') : 
                  chalk.red('❌ Not installed')}`);
    console.log(`   Installed: ${status.installed ? '✅' : '❌'}`);
    console.log(`   Built: ${status.built ? '✅' : '❌'}`);
    
    if (status.requiredEnv.length > 0) {
      console.log(`   Required env: ${status.requiredEnv.join(', ')}`);
    }
    
    if (status.features.length > 0) {
      console.log(`   Features: ${status.features.slice(0, 3).join(', ')}...`);
    }
    
    return status;
  } catch (error) {
    spinner.fail(`Failed to check status: ${error.message}`);
    return null;
  }
};

// Get environment variables
const getEnvVars = async (serverName) => {
  const server = manager.getServer(serverName);
  
  if (!server.requiredEnv || Object.keys(server.requiredEnv).length === 0) {
    return {};
  }
  
  // Get environment variables from .env first
  const { envVars, missingVars } = manager.getEnvironmentVariables(serverName);
  
  // Show which variables were loaded from .env
  if (Object.keys(envVars).length > 0) {
    console.log(chalk.green('\n✅ Loaded from .env:'));
    for (const key of Object.keys(envVars)) {
      const value = envVars[key];
      const masked = key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET') 
        ? value.substring(0, 6) + '***' 
        : value;
      console.log(chalk.gray(`   ${key}: ${masked}`));
    }
  }
  
  // Only prompt for missing required variables
  if (missingVars.length > 0) {
    console.log(chalk.yellow('\n🔑 Additional environment variables needed:'));
    
    const questions = [];
    for (const { key, config } of missingVars) {
      questions.push({
        type: config.sensitive ? 'password' : 'input',
        name: key,
        message: `${config.description} (${key}):`,
        validate: (input) => {
          if (config.required && !input) {
            return `${key} is required`;
          }
          return true;
        }
      });
    }
    
    const answers = await inquirer.prompt(questions);
    Object.assign(envVars, answers);
  }
  
  return envVars;
};

// Quick launch server (direct mode)
const quickLaunch = async (serverName) => {
  console.log(chalk.bold(`\n🚀 Quick launching ${serverName}...\n`));
  
  // Check and setup server
  const spinner = ora('Setting up server...').start();
  
  try {
    await manager.setupServer(serverName, (msg) => {
      spinner.text = msg;
    });
    spinner.succeed('Server ready');
  } catch (error) {
    spinner.fail(`Setup failed: ${error.message}`);
    return;
  }
  
  // Get environment variables
  const envVars = await getEnvVars(serverName);
  
  // Test connection
  const testSpinner = ora('Testing server connection...').start();
  try {
    const result = await manager.testServer(serverName, envVars);
    if (result.success) {
      testSpinner.succeed('Server connection successful');
    } else {
      testSpinner.fail(`Server test failed: ${result.message}`);
      console.log(chalk.red('\n❌ Server not responding correctly.'));
      console.log(chalk.yellow('Please check:'));
      console.log('  1. Environment variables are correct');
      console.log('  2. Server dependencies installed and built');
      console.log('  3. Test manually with:');
      console.log(chalk.cyan(`     cd mcp-hub/servers/${serverName}`));
      
      // Show correct test command based on server type
      const server = manager.getServer(serverName);
      if (server.type === 'python') {
        console.log(chalk.cyan(`     echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | ${server.commands.start}`));
      } else {
        console.log(chalk.cyan(`     echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node ${server.commands.start.split(' ').slice(1).join(' ')}`));
      }
      
      const { continueAnyway } = await inquirer.prompt([{
        type: 'confirm',
        name: 'continueAnyway',
        message: 'Continue anyway (config may not work)?',
        default: false
      }]);
      
      if (!continueAnyway) {
        console.log(chalk.yellow('\n💡 Fix the issues and try again.'));
        return;
      }
    }
  } catch (error) {
    testSpinner.fail(`Connection test failed: ${error.message}`);
    console.log(chalk.red('\n❌ Unable to test server connection.'));
    return;
  }
  
  // Generate config
  const configSpinner = ora('Generating Claude Desktop config...').start();
  try {
    const { config, configPath } = await manager.generateConfig(serverName, envVars);
    configSpinner.succeed(`Config saved to ${configPath}`);
    
    // Ask to copy to Claude Desktop
    const { copyConfig } = await inquirer.prompt([{
      type: 'confirm',
      name: 'copyConfig',
      message: 'Copy configuration to Claude Desktop?',
      default: true
    }]);
    
    if (copyConfig) {
      const copySpinner = ora('Copying to Claude Desktop...').start();
      try {
        const { path } = await manager.copyToClaudeDesktop(serverName, config);
        copySpinner.succeed(`Config copied to ${path}`);
        console.log(chalk.green('\n✅ Server configured successfully!'));
        console.log(chalk.yellow('⚠️  Restart Claude Desktop to apply changes'));
      } catch (error) {
        copySpinner.fail(`Failed to copy config: ${error.message}`);
      }
    }
  } catch (error) {
    configSpinner.fail(`Config generation failed: ${error.message}`);
  }
};

// Interactive menu
const interactiveMenu = async () => {
  const servers = manager.getServers();
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: '🚀 Quick Launch (Setup & Configure)', value: 'launch' },
      { name: '📋 List All Servers', value: 'list' },
      { name: '📦 Setup Server (Install & Build)', value: 'setup' },
      { name: '🔧 Generate Configuration', value: 'config' },
      { name: '✅ Test Server Connection', value: 'test' },
      { name: '📁 Copy Config to Claude Desktop', value: 'copy' },
      { name: '❌ Exit', value: 'exit' }
    ]
  }]);
  
  if (action === 'exit') {
    console.log(chalk.cyan('\n👋 Goodbye!'));
    process.exit(0);
  }
  
  if (action === 'list') {
    console.log(chalk.bold('\n📦 Available MCP Servers:\n'));
    for (const serverName of servers) {
      await showServerStatus(serverName);
    }
    console.log('');
    return interactiveMenu();
  }
  
  // For other actions, select a server
  const { selectedServer } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedServer',
    message: 'Select a server:',
    choices: servers.map(name => {
      const server = manager.getServer(name);
      return {
        name: `${server.name} - ${server.description}`,
        value: name
      };
    })
  }]);
  
  switch (action) {
    case 'launch':
      await quickLaunch(selectedServer);
      break;
      
    case 'setup':
      const setupSpinner = ora('Setting up server...').start();
      try {
        await manager.setupServer(selectedServer, (msg) => {
          setupSpinner.text = msg;
        });
        setupSpinner.succeed('Server setup complete');
      } catch (error) {
        setupSpinner.fail(`Setup failed: ${error.message}`);
      }
      break;
      
    case 'config':
      const envVars = await getEnvVars(selectedServer);
      const { readOnly } = await inquirer.prompt([{
        type: 'confirm',
        name: 'readOnly',
        message: 'Enable read-only mode?',
        default: false
      }]);
      
      try {
        const { configPath } = await manager.generateConfig(
          selectedServer, 
          envVars,
          { readOnly }
        );
        console.log(chalk.green(`✅ Config saved to ${configPath}`));
      } catch (error) {
        console.error(chalk.red(`Failed to generate config: ${error.message}`));
      }
      break;
      
    case 'test':
      const testEnvVars = await getEnvVars(selectedServer);
      const testSpinner = ora('Testing server...').start();
      try {
        const result = await manager.testServer(selectedServer, testEnvVars);
        if (result.success) {
          testSpinner.succeed(`Server test successful: ${result.message}`);
        } else {
          testSpinner.fail(`Server test failed: ${result.message}`);
        }
      } catch (error) {
        testSpinner.fail(`Test error: ${error.message}`);
      }
      break;
      
    case 'copy':
      const copySpinner = ora('Copying config to Claude Desktop...').start();
      try {
        const { path } = await manager.copyToClaudeDesktop(selectedServer);
        copySpinner.succeed(`Config copied to ${path}`);
        console.log(chalk.yellow('⚠️  Restart Claude Desktop to apply changes'));
      } catch (error) {
        copySpinner.fail(`Copy failed: ${error.message}`);
      }
      break;
  }
  
  // Return to menu
  console.log('');
  return interactiveMenu();
};

// Main CLI entry point
const main = async () => {
  try {
    // Load registry
    await manager.loadRegistry();
    
    // Parse command line arguments
    program
      .name('mcp-hub')
      .description('MCP Hub Manager - Manage multiple MCP servers')
      .version('1.0.0');
    
    // Add server options dynamically
    const servers = manager.getServers();
    servers.forEach(serverName => {
      program.option(`--${serverName}`, `Quick launch ${serverName} server`);
    });
    
    program.parse(process.argv);
    const options = program.opts();
    
    // Check for direct server launch
    for (const serverName of servers) {
      if (options[serverName]) {
        showHeader();
        await quickLaunch(serverName);
        process.exit(0);
      }
    }
    
    // No direct option, show interactive menu
    showHeader();
    await interactiveMenu();
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    process.exit(1);
  }
};

// Run the CLI
main();