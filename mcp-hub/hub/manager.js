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
    
    // For Python servers, check if .venv exists in server directory
    if (server.type === 'python') {
      const venvPath = path.join(serverPath, '.venv');
      try {
        await fs.access(venvPath);
        server.installed = true;
        return true;
      } catch {
        server.installed = false;
        return false;
      }
    }
    
    // For Supabase monorepo, check if key dependency exists
    if (serverName === 'supabase') {
      const sdkPath = path.join(serverPath, 'node_modules', '@modelcontextprotocol', 'sdk');
      try {
        await fs.access(sdkPath);
        server.installed = true;
        return true;
      } catch {
        server.installed = false;
        return false;
      }
    }
    
    // For other Node.js servers, check for node_modules
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
    
    // Python servers don't need building
    if (server.type === 'python') {
      server.built = true;
      return true;
    }
    
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
      // Python servers use UV to install dependencies in their own venv
      if (server.type === 'python') {
        if (onProgress) onProgress(`Installing Python dependencies with UV for ${server.name}...`);
        
        try {
          // First, ensure venv exists (UV needs to create it with proper platform)
          const venvPath = path.join(serverPath, '.venv');
          const venvExists = await fs.access(venvPath).then(() => true).catch(() => false);
          
          if (!venvExists) {
            if (onProgress) onProgress(`Creating Python virtual environment...`);
            const createVenvCmd = process.platform === 'win32'
              ? `"${process.env.USERPROFILE}\\.local\\bin\\uv.exe" venv`
              : 'uv venv';
            
            await execAsync(createVenvCmd, {
              cwd: serverPath,
              env: { ...process.env },
              maxBuffer: 1024 * 1024 * 10
            });
          }
          
          // Now install the package in editable mode
          if (onProgress) onProgress(`Installing package dependencies...`);
          const uvCommand = process.platform === 'win32'
            ? `"${process.env.USERPROFILE}\\.local\\bin\\uv.exe" pip install -e .`
            : 'uv pip install -e .';
          
          const { stdout, stderr } = await execAsync(uvCommand, {
            cwd: serverPath,
            env: { ...process.env },
            maxBuffer: 1024 * 1024 * 10
          });
          
          // Verify the package is actually installed
          if (onProgress) onProgress(`Verifying installation...`);
          const pythonPath = process.platform === 'win32'
            ? path.join(serverPath, '.venv', 'Scripts', 'python.exe')
            : path.join(serverPath, '.venv', 'bin', 'python');
          
          const verifyCmd = `"${pythonPath}" -c "import mcp_server_pg.server"`;
          try {
            await execAsync(verifyCmd, { cwd: serverPath });
            if (onProgress) onProgress(`✅ Package verified successfully`);
          } catch (verifyError) {
            console.error('Package verification failed:', verifyError.message);
            throw new Error('Package installed but module cannot be imported. Check pyproject.toml configuration.');
          }
          
          server.installed = true;
          await this.saveRegistry();
          if (onProgress) onProgress(`✅ Python dependencies installed for ${server.name}`);
          return { success: true, output: stdout };
        } catch (error) {
          if (onProgress) onProgress(`❌ Failed to install ${server.name}: ${error.message}`);
          throw error;
        }
      }
      
      // For monorepo servers (like Supabase), pnpm needs special handling
      let installCommand = server.commands.install;
      let installEnv = { ...process.env, CI: 'true' };
      
      if (server.monorepo && server.packageManager === 'pnpm') {
        // For pnpm monorepos, we need to ensure all workspace dependencies are installed
        installCommand = 'pnpm install --frozen-lockfile';
        // Remove CI flag for pnpm as it can cause issues
        installEnv = { ...process.env };
      }

      const { stdout, stderr } = await execAsync(installCommand, {
        cwd: serverPath,
        env: installEnv,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large installs
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
      // Some servers might not have a build step
      if (!server.commands.build || server.commands.build === 'none') {
        if (onProgress) onProgress(`ℹ️ No build step required for ${server.name}`);
        server.built = true;
        await this.saveRegistry();
        return { success: true, output: 'No build required' };
      }

      const { stdout, stderr } = await execAsync(server.commands.build, {
        cwd: serverPath,
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large builds
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
    
    let command, args;
    const isWindows = process.platform === 'win32';
    
    // Handle Python servers - use venv Python directly for testing
    if (server.type === 'python') {
      // For testing, use the venv Python directly (more reliable than UV for stdio)
      if (isWindows) {
        command = path.join(serverPath, '.venv', 'Scripts', 'python.exe');
      } else {
        command = path.join(serverPath, '.venv', 'bin', 'python');
      }
      
      // Check if venv exists
      try {
        await fs.access(command);
      } catch {
        console.error(`Python venv not found at ${command}`);
        console.error(`Please run: cd ${serverPath} && uv pip install -e .`);
        throw new Error(`Python environment not set up for ${serverName}`);
      }
      
      // Parse module from start command (e.g., "python -m mcp_server_pg.server")
      const moduleParts = server.commands.start.split(' ');
      const moduleIndex = moduleParts.indexOf('-m');
      if (moduleIndex !== -1 && moduleParts[moduleIndex + 1]) {
        args = ['-m', moduleParts[moduleIndex + 1]];
      } else {
        // Fallback to full command
        args = moduleParts.slice(1);
      }
      
      // Log for debugging
      console.log(`Testing Python server with: ${command} ${args.join(' ')}`);
    } else {
      // Handle Node.js servers
      const startCommand = server.commands.start.split(' ');
      command = startCommand[0];
      args = startCommand.slice(1);

      // For monorepo servers, keep paths relative to allow proper module resolution
      // For non-monorepo servers, resolve to absolute paths
      if (!server.monorepo && args[0] && !path.isAbsolute(args[0])) {
        args[0] = path.join(serverPath, args[0]);
      }
    }

    // For Supabase, pass project-ref as CLI arg but use env for token
    if (serverName === 'supabase') {
      if (envVars.SUPABASE_PROJECT_REF) {
        args.push('--project-ref', envVars.SUPABASE_PROJECT_REF);
      }
      // Add read-only flag for safety
      args.push('--read-only');
    }

    return new Promise((resolve, reject) => {
      // Only use shell for Node.js servers on Windows, not Python
      const useShell = isWindows && server.type !== 'python';
      
      const child = spawn(command, args, {
        cwd: serverPath,
        env: { ...process.env, ...envVars },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: useShell,
        windowsHide: true
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
        // Log Python import errors immediately
        if (server.type === 'python' && errorOutput.includes('ModuleNotFoundError')) {
          console.error('Python module error:', errorOutput);
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`Failed to spawn ${command}:`, error.message);
        reject({ success: false, message: error.message });
      });

      // Send init request after a delay
      setTimeout(() => {
        child.stdin.write(initRequest);
        // Don't end stdin - MCP is a continuous protocol
      }, 500);

      // Timeout after 10 seconds (Supabase needs time to connect to API)
      timeout = setTimeout(() => {
        child.kill();
        resolve({ 
          success: false, 
          message: 'Server did not respond within 10 seconds',
          output,
          errorOutput
        });
      }, 10000);
    });
  }

  /**
   * Generate Claude Desktop configuration
   */
  async generateConfig(serverName, envVars = {}, options = {}) {
    const server = this.getServer(serverName);
    if (!server) throw new Error(`Server ${serverName} not found`);

    const serverPath = path.resolve(this.hubRoot, server.path);
    
    // Detect Windows platform
    const isWindows = process.platform === 'win32';
    
    let command, args;
    
    // Handle Python servers - use UV
    if (server.type === 'python') {
      if (isWindows) {
        const homeDir = process.env.USERPROFILE || process.env.HOME;
        command = path.join(homeDir, '.local', 'bin', 'uv.exe');
        command = command.replace(/\//g, '\\');
        
        const moduleParts = server.commands.start.split(' ');
        args = [
          '--directory',
          serverPath.replace(/\//g, '\\'),
          'run',
          ...moduleParts
        ];
      } else {
        command = 'uv';
        const moduleParts = server.commands.start.split(' ');
        args = [
          '--directory',
          serverPath,
          'run',
          ...moduleParts
        ];
      }
    } else {
      // Handle Node.js servers
      const startCommand = server.commands.start.split(' ');
      command = startCommand[0];
      args = startCommand.slice(1);

      // For Windows, use full path to node.exe
      if (isWindows && command === 'node') {
        command = 'C:\\Program Files\\nodejs\\node.exe';
      }

      // Always resolve script path to absolute path for Node.js servers
      if (args[0] && !path.isAbsolute(args[0])) {
        args[0] = path.resolve(serverPath, args[0]);
      }
      
      // Convert paths to Windows format if on Windows
      if (isWindows) {
        // Convert forward slashes to backslashes for Windows
        if (args[0]) {
          args[0] = args[0].replace(/\//g, '\\');
        }
        command = command.replace(/\//g, '\\');
      }
    }

    // For Supabase, pass project-ref as CLI arg but use env for token
    if (serverName === 'supabase') {
      if (envVars.SUPABASE_PROJECT_REF) {
        args.push('--project-ref', envVars.SUPABASE_PROJECT_REF);
      }
      // Add read-only flag for safety
      args.push('--read-only');
    }

    // Add optional arguments (but not for supabase which already has it)
    if (options.readOnly && server.optionalArgs.includes('--read-only') && serverName !== 'supabase') {
      args.push('--read-only');
    }

    // Build config
    const serverConfig = {
      command,
      args
    };
    
    // Add env vars if present
    if (Object.keys(envVars).length > 0) {
      serverConfig.env = envVars;
    }
    
    // Always add cwd for better reliability (convert to Windows format if needed)
    serverConfig.cwd = isWindows ? serverPath.replace(/\//g, '\\') : serverPath;
    
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