#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hubRoot = path.resolve(__dirname, '..');

// Platform detection
const isWindows = process.platform === 'win32';
const homeDir = os.homedir();

class MCPHubSetup {
  constructor() {
    this.uvPath = '';
  }

  async run() {
    console.log(chalk.cyan('\n🚀 MCP Hub Advanced Setup\n'));
    
    try {
      // Check and install uv
      await this.setupUv();
      
      // Check for pnpm (needed for some servers)
      await this.checkPnpm();
      
      // Update configuration
      await this.updateConfiguration();
      
      console.log(chalk.green('\n✅ Setup completed successfully!\n'));
      console.log(chalk.yellow('Next steps:'));
      console.log('  1. Run: ' + chalk.cyan('npm run mcp'));
      console.log('  2. Select a server to configure');
      console.log('  3. Follow the prompts to set up Claude Desktop\n');
      
    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), error.message);
      process.exit(1);
    }
  }

  async setupUv() {
    const spinner = ora('Checking for uv package manager...').start();
    
    try {
      // Check if uv is already installed
      const uvCommand = isWindows 
        ? path.join(homeDir, '.local', 'bin', 'uv.exe')
        : 'uv';
      
      try {
        await execAsync(`"${uvCommand}" --version`);
        this.uvPath = uvCommand;
        spinner.succeed('uv package manager found');
        return;
      } catch {
        // uv not found, need to install
      }
      
      spinner.text = 'Installing uv package manager...';
      
      // Install uv using the official installer
      if (isWindows) {
        // Windows: Use PowerShell to install uv
        const installCmd = `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`;
        await execAsync(installCmd);
        this.uvPath = path.join(homeDir, '.local', 'bin', 'uv.exe');
      } else {
        // Unix/Mac: Use curl installer
        const installCmd = `curl -LsSf https://astral.sh/uv/install.sh | sh`;
        await execAsync(installCmd);
        this.uvPath = 'uv';
      }
      
      // Verify installation
      await execAsync(`"${this.uvPath}" --version`);
      spinner.succeed('uv package manager installed successfully');
      
    } catch (error) {
      spinner.warn('uv installation failed - will use pip instead');
      // Fall back to pip
      this.uvPath = null;
    }
  }


  async checkPnpm() {
    const spinner = ora('Checking for pnpm...').start();
    
    try {
      await execAsync('pnpm --version');
      spinner.succeed('pnpm found');
    } catch {
      spinner.text = 'Installing pnpm...';
      try {
        await execAsync('npm install -g pnpm');
        spinner.succeed('pnpm installed');
      } catch (error) {
        spinner.warn('pnpm installation failed - some servers may not work');
        // Don't fail the whole setup for this
      }
    }
  }

  async updateConfiguration() {
    const spinner = ora('Updating configuration...').start();
    
    try {
      // Create or update .env.example if it doesn't exist
      const envExamplePath = path.join(hubRoot, '.env.example');
      try {
        await fs.access(envExamplePath);
      } catch {
        // Create basic .env.example
        const envContent = `# ============================================
# MCP Hub Environment Configuration
# ============================================
# Copy this file to .env and fill in your values

# PostgreSQL Tools Server
DATABASE_URL=postgresql://user:password@host:port/database

# Supabase MCP Server
SUPABASE_ACCESS_TOKEN=
SUPABASE_PROJECT_REF=

# Add your server configurations here
`;
        await fs.writeFile(envExamplePath, envContent);
      }
      
      // Update package.json with setup script if needed
      const packageJsonPath = path.join(hubRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      if (!packageJson.scripts['setup:init']) {
        packageJson.scripts['setup:init'] = 'node hub/setup.js';
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }
      
      spinner.succeed('Configuration updated');
    } catch (error) {
      spinner.warn('Configuration update had issues but continuing...');
    }
  }
}

// Run setup if called directly
if (import.meta.url === `file://${__filename}`) {
  const setup = new MCPHubSetup();
  setup.run().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}