import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MCPHubManager {
  constructor() {
    this.registryPath = path.join(__dirname, 'registry.json');
    this.hubRoot = path.resolve(__dirname, '..');
    this.configsDir = path.join(this.hubRoot, 'configs');
    this.registry = null;
    
    // Load environment variables from .env file
    this.loadEnvironment();
  }

  /**
   * Load environment variables from .env file
   */
  loadEnvironment() {
    const envPath = path.join(this.hubRoot, '.env');
    dotenv.config({ path: envPath });
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
    let args = startCommand.slice(1);

    // For monorepo servers, keep paths relative to allow proper module resolution
    // For non-monorepo servers, resolve to absolute paths
    if (!server.monorepo && args[0] && !path.isAbsolute(args[0])) {
      args[0] = path.join(serverPath, args[0]);
    }

    // Special handling for Supabase server - pass CLI arguments
    if (serverName === 'supabase') {
      if (envVars.SUPABASE_ACCESS_TOKEN) {
        args.push('--access-token', envVars.SUPABASE_ACCESS_TOKEN);
      }
      if (envVars.SUPABASE_PROJECT_REF) {
        args.push('--project-ref', envVars.SUPABASE_PROJECT_REF);
      }
    }

    // Debug logging for Supabase
    if (serverName === 'supabase') {
      console.error('DEBUG: Testing Supabase with command:', command);
      console.error('DEBUG: Args:', args);
      console.error('DEBUG: CWD:', serverPath);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: serverPath,
        env: { ...process.env, ...envVars },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      if (serverName === 'supabase') {
        console.error('DEBUG: Child process spawned, PID:', child.pid);
      }

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
        if (serverName === 'supabase') {
          console.error('DEBUG: Got stdout data:', data.toString());
        }
        
        // Check for successful initialization
        if (output.includes('"id":1') && output.includes('"result"')) {
          clearTimeout(timeout);
          child.kill();
          resolve({ success: true, message: 'Server responded successfully' });
        }
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
        if (serverName === 'supabase') {
          console.error('DEBUG: Got stderr data:', data.toString());
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        if (serverName === 'supabase') {
          console.error('DEBUG: Process error:', error);
        }
        reject({ success: false, message: error.message });
      });

      child.on('exit', (code, signal) => {
        if (serverName === 'supabase') {
          console.error('DEBUG: Process exited with code:', code, 'signal:', signal);
        }
      });

      // Send init immediately for Supabase, delay for others
      if (serverName === 'supabase') {
        // Supabase needs the init request immediately
        console.error('DEBUG: Sending init request immediately');
        child.stdin.write(initRequest);
      } else {
        // Other servers may need a short delay
        setTimeout(() => {
          child.stdin.write(initRequest);
        }, 500);
      }

      // Timeout after 5 seconds
      timeout = setTimeout(() => {
        child.kill();
        // Debug output for Supabase
        if (serverName === 'supabase' && (output || errorOutput)) {
          console.error('DEBUG: Server output:', output);
          console.error('DEBUG: Server errors:', errorOutput);
        }
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

    // For monorepo servers, keep paths relative and use serverPath as cwd
    // For non-monorepo servers, resolve to absolute paths
    if (!server.monorepo && args[0] && !path.isAbsolute(args[0])) {
      args[0] = path.resolve(serverPath, args[0]);
    }

    // Special handling for Supabase server - pass CLI arguments
    if (serverName === 'supabase') {
      if (envVars.SUPABASE_ACCESS_TOKEN) {
        args.push('--access-token', envVars.SUPABASE_ACCESS_TOKEN);
      }
      if (envVars.SUPABASE_PROJECT_REF) {
        args.push('--project-ref', envVars.SUPABASE_PROJECT_REF);
      }
    }

    // Add optional arguments
    if (options.readOnly && server.optionalArgs.includes('--read-only')) {
      args.push('--read-only');
    }

    // Build config with cwd for monorepo servers
    const serverConfig = {
      command,
      args,
      env: envVars
    };
    
    // Add cwd for monorepo servers to ensure proper module resolution
    if (server.monorepo) {
      serverConfig.cwd = serverPath;
    }
    
    const config = {
      mcpServers: {
        [serverName]: serverConfig
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

  /**
   * Get environment variables for a server, checking .env first
   */
  getEnvironmentVariables(serverName) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const envVars = {};
    const missingVars = [];

    // Check each required environment variable
    for (const [key, config] of Object.entries(server.requiredEnv || {})) {
      // Check if it exists in process.env (loaded from .env)
      if (process.env[key]) {
        envVars[key] = process.env[key];
      } else if (config.required) {
        missingVars.push({ key, config });
      }
    }

    return { envVars, missingVars };
  }

  /**
   * Check if all required environment variables are available
   */
  hasAllEnvironmentVariables(serverName) {
    const { missingVars } = this.getEnvironmentVariables(serverName);
    return missingVars.length === 0;
  }
}