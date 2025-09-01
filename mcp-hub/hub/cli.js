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

// View Claude Desktop servers
const viewClaudeServers = async () => {
  const spinner = ora('Reading Claude Desktop configuration...').start();
  
  try {
    const servers = await manager.getExistingServers();
    spinner.stop();
    
    if (servers.length === 0) {
      console.log(chalk.yellow('\n📭 No MCP servers configured in Claude Desktop'));
      return;
    }
    
    console.log(chalk.bold('\n🔍 Claude Desktop MCP Servers:\n'));
    
    for (const server of servers) {
      // Color based on whether it's managed by this hub
      const nameColor = server.inRegistry ? chalk.green : chalk.cyan;
      const typeLabel = server.inRegistry ? ' (Hub Managed)' : ' (External)';
      
      console.log(nameColor(`📦 ${server.name}${typeLabel}`));
      console.log(chalk.gray(`   Command: ${server.command}`));
      
      if (server.args && server.args.length > 0) {
        const argsDisplay = server.args.length > 3 
          ? `${server.args.slice(0, 3).join(' ')}...` 
          : server.args.join(' ');
        console.log(chalk.gray(`   Args: ${argsDisplay}`));
      }
      
      if (server.cwd) {
        console.log(chalk.gray(`   Working Dir: ${server.cwd}`));
      }
      
      if (Object.keys(server.env).length > 0) {
        const envKeys = Object.keys(server.env);
        const envDisplay = envKeys.map(k => {
          const value = server.env[k];
          // Mask sensitive values
          const masked = k.includes('TOKEN') || k.includes('KEY') || k.includes('SECRET')
            ? '***' 
            : value.substring(0, 20) + (value.length > 20 ? '...' : '');
          return `${k}=${masked}`;
        }).join(', ');
        console.log(chalk.gray(`   Env: ${envDisplay}`));
      }
      
      if (server.registryDetails) {
        console.log(chalk.gray(`   Type: ${server.registryDetails.type}`));
        console.log(chalk.gray(`   Description: ${server.registryDetails.description}`));
      }
      
      console.log('');
    }
    
    console.log(chalk.gray(`Total: ${servers.length} server(s) configured`));
    
  } catch (error) {
    spinner.fail(`Failed to read Claude config: ${error.message}`);
  }
};

// Manage Claude Desktop servers (remove unwanted ones)
const manageClaudeServers = async () => {
  const spinner = ora('Reading Claude Desktop configuration...').start();
  
  try {
    const servers = await manager.getExistingServers();
    spinner.stop();
    
    if (servers.length === 0) {
      console.log(chalk.yellow('\n📭 No MCP servers to manage in Claude Desktop'));
      return;
    }
    
    // Create choices for multi-select
    const choices = servers.map(server => ({
      name: `${server.name}${server.inRegistry ? ' (Hub)' : ' (External)'} - ${server.command}`,
      value: server.name,
      checked: false
    }));
    
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '🗑️ Remove selected servers', value: 'remove' },
        { name: '🧹 Remove all servers', value: 'remove-all' },
        { name: '⬅️ Back to main menu', value: 'back' }
      ]
    }]);
    
    if (action === 'back') {
      return;
    }
    
    let serversToRemove = [];
    
    if (action === 'remove-all') {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.red(`Are you sure you want to remove ALL ${servers.length} server(s) from Claude Desktop?`),
        default: false
      }]);
      
      if (!confirm) {
        console.log(chalk.yellow('✋ Operation cancelled'));
        return;
      }
      
      serversToRemove = servers.map(s => s.name);
    } else {
      // Select specific servers to remove
      const { selected } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selected',
        message: 'Select servers to remove:',
        choices,
        validate: (input) => {
          if (input.length === 0) {
            return 'Please select at least one server to remove';
          }
          return true;
        }
      }]);
      
      if (selected.length === 0) {
        return;
      }
      
      // Confirm removal
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Remove ${selected.length} server(s) from Claude Desktop?`,
        default: true
      }]);
      
      if (!confirm) {
        console.log(chalk.yellow('✋ Operation cancelled'));
        return;
      }
      
      serversToRemove = selected;
    }
    
    // Remove the servers
    const removeSpinner = ora('Removing servers from Claude Desktop...').start();
    
    try {
      const result = await manager.removeServerFromConfig(serversToRemove);
      removeSpinner.succeed(chalk.green(`✅ Removed ${result.removed.length} server(s)`));
      
      if (result.removed.length > 0) {
        console.log(chalk.gray('\nRemoved servers:'));
        result.removed.forEach(name => {
          console.log(chalk.gray(`  - ${name}`));
        });
      }
      
      console.log(chalk.gray(`\nRemaining servers: ${result.remaining.length}`));
      console.log(chalk.yellow('\n⚠️  Restart Claude Desktop to apply changes'));
      
    } catch (error) {
      removeSpinner.fail(`Failed to remove servers: ${error.message}`);
    }
    
  } catch (error) {
    spinner.fail(`Failed to read Claude config: ${error.message}`);
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
      { name: '🔍 View Claude Desktop Servers', value: 'view-claude' },
      { name: '🗑️ Manage Claude Desktop Servers', value: 'manage-claude' },
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
  
  // Handle View Claude Desktop Servers
  if (action === 'view-claude') {
    await viewClaudeServers();
    return interactiveMenu();
  }
  
  // Handle Manage Claude Desktop Servers
  if (action === 'manage-claude') {
    await manageClaudeServers();
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