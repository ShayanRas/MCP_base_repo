import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MCPHubManager {
  constructor() {
    this.registryPath = path.join(__dirname, 'registry.json');
    this.hubRoot = path.resolve(__dirname, '..');
    this.configsDir = path.join(this.hubRoot, 'configs');
    this.registry = null;
  }

  /**
   * Load the registry of available MCP servers
   */
  async loadRegistry() {
    try {
      const data = await fs.readFile(this.registryPath, 'utf-8');
      this.registry = JSON.parse(data);
      return this.registry;
    } catch (error) {
      console.error('Failed to load registry:', error.message);
      throw error;
    }
  }

  /**
   * Save the registry after updates
   */
  async saveRegistry() {
    try {
      await fs.writeFile(
        this.registryPath,
        JSON.stringify(this.registry, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save registry:', error.message);
      throw error;
    }
  }

  /**
   * Get list of available servers
   */
  getServers() {
    if (!this.registry) {
      throw new Error('Registry not loaded. Call loadRegistry() first.');
    }
    return Object.keys(this.registry.servers);
  }

  /**
   * Get server details
   */
  getServer(name) {
    if (!this.registry) {
      throw new Error('Registry not loaded. Call loadRegistry() first.');
    }
    return this.registry.servers[name];
  }

  /**
   * Check if server dependencies are installed
   */
  async checkInstalled(serverName) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const serverPath = path.join(this.hubRoot, server.path);
    const nodeModulesPath = path.join(serverPath, 'node_modules');

    try {
      await fs.access(nodeModulesPath);
      server.installed = true;
      return true;
    } catch {
      server.installed = false;
      return false;
    }
  }

  /**
   * Check if server is built
   */
  async checkBuilt(serverName) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const serverPath = path.join(this.hubRoot, server.path);
    
    // For everything server, check dist folder
    if (serverName === 'everything') {
      const distPath = path.join(serverPath, 'dist');
      try {
        await fs.access(distPath);
        server.built = true;
        return true;
      } catch {
        server.built = false;
        return false;
      }
    }
    
    // For supabase, check specific dist location
    if (serverName === 'supabase') {
      const distPath = path.join(serverPath, 'packages/mcp-server-supabase/dist');
      try {
        await fs.access(distPath);
        server.built = true;
        return true;
      } catch {
        server.built = false;
        return false;
      }
    }

    return false;
  }

  /**
   * Install server dependencies
   */
  async installServer(serverName, onProgress) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const serverPath = path.join(this.hubRoot, server.path);

    if (onProgress) onProgress(`Installing dependencies for ${server.name}...`);

    try {
      const { stdout, stderr } = await execAsync(server.commands.install, {
        cwd: serverPath,
        env: { ...process.env, CI: 'true' }
      });

      server.installed = true;
      await this.saveRegistry();

      if (onProgress) onProgress(`✅ Dependencies installed for ${server.name}`);
      return { success: true, output: stdout };
    } catch (error) {
      if (onProgress) onProgress(`❌ Failed to install ${server.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build server
   */
  async buildServer(serverName, onProgress) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const serverPath = path.join(this.hubRoot, server.path);

    if (onProgress) onProgress(`Building ${server.name}...`);

    try {
      const { stdout, stderr } = await execAsync(server.commands.build, {
        cwd: serverPath
      });

      server.built = true;
      await this.saveRegistry();

      if (onProgress) onProgress(`✅ Built ${server.name}`);
      return { success: true, output: stdout };
    } catch (error) {
      if (onProgress) onProgress(`❌ Failed to build ${server.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test server connection
   */
  async testServer(serverName, envVars = {}) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const serverPath = path.join(this.hubRoot, server.path);
    const startCommand = server.commands.start.split(' ');
    const command = startCommand[0];
    const args = startCommand.slice(1);

    // Resolve relative paths
    if (args[0] && !path.isAbsolute(args[0])) {
      args[0] = path.join(serverPath, args[0]);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: serverPath,
        env: { ...process.env, ...envVars },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      let timeout;

      // Send initialization request
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'mcp-hub-test',
            version: '1.0.0'
          }
        },
        id: 1
      }) + '\n';

      child.stdout.on('data', (data) => {
        output += data.toString();
        
        // Check for successful initialization
        if (output.includes('"id":1') && output.includes('"result"')) {
          clearTimeout(timeout);
          child.kill();
          resolve({ success: true, message: 'Server responded successfully' });
        }
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject({ success: false, message: error.message });
      });

      // Send init after short delay
      setTimeout(() => {
        child.stdin.write(initRequest);
      }, 500);

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        child.kill();
        resolve({ 
          success: false, 
          message: 'Server did not respond within 5 seconds',
          output,
          errorOutput
        });
      }, 5000);
    });
  }

  /**
   * Generate Claude Desktop configuration
   */
  async generateConfig(serverName, envVars = {}, options = {}) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const serverPath = path.resolve(this.hubRoot, server.path);
    const startCommand = server.commands.start.split(' ');
    const command = startCommand[0];
    let args = startCommand.slice(1);

    // Resolve the script path to absolute
    if (args[0] && !path.isAbsolute(args[0])) {
      args[0] = path.resolve(serverPath, args[0]);
    }

    // Add optional arguments
    if (options.readOnly && server.optionalArgs.includes('--read-only')) {
      args.push('--read-only');
    }

    const config = {
      mcpServers: {
        [serverName]: {
          command,
          args,
          env: envVars
        }
      }
    };

    // Save to configs directory
    const configPath = path.join(this.configsDir, `${serverName}-config.json`);
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return { config, configPath };
  }

  /**
   * Get Claude Desktop config path for current platform
   */
  getClaudeConfigPath() {
    const platform = process.platform;
    const homeDir = process.env.HOME || process.env.USERPROFILE;

    switch (platform) {
      case 'win32':
        return path.join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      case 'linux':
        return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Copy configuration to Claude Desktop
   */
  async copyToClaudeDesktop(serverName, config = null) {
    const claudePath = this.getClaudeConfigPath();
    
    // Create directory if it doesn't exist
    const claudeDir = path.dirname(claudePath);
    try {
      await fs.mkdir(claudeDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Load or use provided config
    if (!config) {
      const configPath = path.join(this.configsDir, `${serverName}-config.json`);
      const configData = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configData);
    }

    // Check if Claude config exists and merge
    let existingConfig = {};
    try {
      const existing = await fs.readFile(claudePath, 'utf-8');
      existingConfig = JSON.parse(existing);
      
      // Backup existing config
      if (this.registry.config.backupConfigs) {
        const backupPath = `${claudePath}.backup-${Date.now()}`;
        await fs.writeFile(backupPath, existing, 'utf-8');
      }
    } catch {
      // No existing config
    }

    // Merge configurations
    const mergedConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingConfig.mcpServers,
        ...config.mcpServers
      }
    };

    // Write merged config
    await fs.writeFile(claudePath, JSON.stringify(mergedConfig, null, 2), 'utf-8');

    return { path: claudePath, config: mergedConfig };
  }

  /**
   * Get server status
   */
  async getServerStatus(serverName) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const installed = await this.checkInstalled(serverName);
    const built = installed ? await this.checkBuilt(serverName) : false;

    const status = {
      name: server.name,
      installed,
      built,
      ready: installed && built,
      requiredEnv: Object.keys(server.requiredEnv),
      features: server.features
    };

    server.status = status.ready ? 'ready' : 
                    status.installed ? 'installed' : 
                    'not-installed';
    
    await this.saveRegistry();
    return status;
  }

  /**
   * Setup server (install and build if needed)
   */
  async setupServer(serverName, onProgress) {
    const status = await this.getServerStatus(serverName);

    if (!status.installed) {
      await this.installServer(serverName, onProgress);
    }

    if (!status.built) {
      await this.buildServer(serverName, onProgress);
    }

    return await this.getServerStatus(serverName);
  }
}