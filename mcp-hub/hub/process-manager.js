import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hubRoot = path.resolve(__dirname, '..');

const PROCESSES_FILE = path.join(hubRoot, '.mcp-processes.json');
const LOGS_DIR = path.join(hubRoot, 'logs');

export class ProcessManager {
  constructor() {
    this.processes = new Map();
    this.loadProcesses();
    this.ensureLogsDir();
  }

  async ensureLogsDir() {
    try {
      await fs.mkdir(LOGS_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  async loadProcesses() {
    try {
      const data = await fs.readFile(PROCESSES_FILE, 'utf-8');
      const processes = JSON.parse(data);
      // Note: We can't restore actual process objects, just the metadata
      // Running processes will need to be re-tracked when restarted
      this.savedProcesses = processes;
    } catch {
      this.savedProcesses = {};
    }
  }

  async saveProcesses() {
    const processData = {};
    for (const [serverName, proc] of this.processes) {
      processData[serverName] = {
        pid: proc.pid,
        port: proc.port,
        transport: proc.transport,
        startTime: proc.startTime,
        command: proc.command,
        args: proc.args
      };
    }
    await fs.writeFile(PROCESSES_FILE, JSON.stringify(processData, null, 2));
  }

  async startHttpServer(serverName, server, options = {}) {
    const {
      port = server.httpConfig?.defaultPort || 3000,
      transport = 'http',
      envVars = {},
      authEnabled = false,
      authToken = null
    } = options;

    // Check if already running
    if (this.processes.has(serverName)) {
      const existing = this.processes.get(serverName);
      if (existing.process && !existing.process.killed) {
        throw new Error(`Server ${serverName} is already running on port ${existing.port}`);
      }
    }

    // Determine command based on transport type
    let command, args;
    const serverPath = path.resolve(hubRoot, server.path);
    
    if (server.type === 'node') {
      const transportCommand = transport === 'sse' ? 'start:sse' : 'start:http';
      
      if (server.monorepo) {
        // For monorepo servers like Supabase
        command = server.packageManager === 'pnpm' ? 'pnpm' : 'npm';
        args = ['run', transportCommand, '--', '--port', port.toString()];
      } else {
        // For regular Node servers
        command = server.commands[transportCommand] || server.commands['start:http'];
        if (!command) {
          throw new Error(`Server ${serverName} doesn't support ${transport} transport`);
        }
        // Parse command
        const parts = command.split(' ');
        command = parts[0];
        args = [...parts.slice(1), '--port', port.toString()];
      }
    } else if (server.type === 'python') {
      // Python server
      if (transport !== 'http') {
        throw new Error(`Python server ${serverName} only supports HTTP transport`);
      }
      
      // Check if we have a virtual environment
      const venvPath = path.join(serverPath, '.venv');
      const venvExists = await fs.access(venvPath).then(() => true).catch(() => false);
      
      if (venvExists) {
        // Use the virtual environment's Python
        command = process.platform === 'win32' 
          ? path.join(venvPath, 'Scripts', 'python.exe')
          : path.join(venvPath, 'bin', 'python');
      } else {
        // Fall back to system Python (prefer python3)
        command = process.platform === 'win32' ? 'python' : 'python3';
      }
      
      // Set PYTHONPATH to ensure module can be found
      if (!envVars.PYTHONPATH) {
        envVars.PYTHONPATH = path.join(serverPath, 'src');
      }
      
      args = ['-m', 'mcp_server_pg.http_server', '--port', port.toString()];
    }

    // Create log file
    const logFile = path.join(LOGS_DIR, `${serverName}-${port}.log`);
    const logStream = await fs.open(logFile, 'a');

    // Prepare environment with auth if enabled
    const processEnv = {
      ...process.env,
      ...envVars,
      PORT: port.toString()
    };
    
    if (authEnabled && authToken) {
      processEnv.MCP_AUTH_ENABLED = 'true';
      processEnv.MCP_AUTH_TOKEN = authToken;
    }
    
    // Spawn the process
    const proc = spawn(command, args, {
      cwd: serverPath,
      env: processEnv,
      detached: false
    });

    // Track the process
    const processInfo = {
      process: proc,
      pid: proc.pid,
      port,
      transport,
      serverName,
      startTime: new Date().toISOString(),
      command,
      args,
      logFile
    };

    this.processes.set(serverName, processInfo);

    // Handle output
    proc.stdout.on('data', (data) => {
      const message = data.toString();
      logStream.write(`[${new Date().toISOString()}] [STDOUT] ${message}`);
      console.log(chalk.gray(`[${serverName}]`), message.trim());
    });

    proc.stderr.on('data', (data) => {
      const message = data.toString();
      logStream.write(`[${new Date().toISOString()}] [STDERR] ${message}`);
      if (!message.includes('Starting') && !message.includes('running on')) {
        console.error(chalk.red(`[${serverName}]`), message.trim());
      } else {
        console.log(chalk.blue(`[${serverName}]`), message.trim());
      }
    });

    proc.on('exit', (code, signal) => {
      console.log(chalk.yellow(`[${serverName}] Process exited with code ${code} signal ${signal}`));
      logStream.write(`[${new Date().toISOString()}] Process exited: code=${code} signal=${signal}\n`);
      logStream.close();
      this.processes.delete(serverName);
      this.saveProcesses();
    });

    proc.on('error', (error) => {
      console.error(chalk.red(`[${serverName}] Process error:`), error.message);
      logStream.write(`[${new Date().toISOString()}] [ERROR] ${error.message}\n`);
      
      // Provide helpful error messages
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow(`💡 Hint: The command '${command}' was not found.`));
        if (server.type === 'python') {
          console.log(chalk.yellow(`   Make sure Python is installed and the virtual environment is set up.`));
          console.log(chalk.yellow(`   Run: cd ${serverPath} && uv venv && uv pip install -e .`));
        } else {
          console.log(chalk.yellow(`   Make sure Node.js is installed and dependencies are installed.`));
          console.log(chalk.yellow(`   Run: cd ${serverPath} && npm install`));
        }
      } else if (error.code === 'EADDRINUSE') {
        console.log(chalk.yellow(`💡 Hint: Port ${port} is already in use.`));
        console.log(chalk.yellow(`   Try a different port or stop the existing process.`));
      }
    });

    // Save process info
    await this.saveProcesses();

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if server is responding
    const isHealthy = await this.checkServerHealth(serverName, port, transport);
    if (!isHealthy) {
      console.warn(chalk.yellow(`Server ${serverName} started but health check failed`));
    }

    return processInfo;
  }

  async stopHttpServer(serverName) {
    const proc = this.processes.get(serverName);
    if (!proc) {
      throw new Error(`Server ${serverName} is not running`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.process.kill('SIGKILL');
        resolve({ forcedKill: true });
      }, 5000);

      proc.process.on('exit', () => {
        clearTimeout(timeout);
        this.processes.delete(serverName);
        this.saveProcesses();
        resolve({ forcedKill: false });
      });

      // Try graceful shutdown first
      proc.process.kill('SIGTERM');
    });
  }

  async stopAllServers() {
    const stopPromises = [];
    for (const [serverName] of this.processes) {
      stopPromises.push(this.stopHttpServer(serverName));
    }
    return Promise.all(stopPromises);
  }

  getRunningServers() {
    const servers = [];
    for (const [serverName, proc] of this.processes) {
      servers.push({
        name: serverName,
        port: proc.port,
        pid: proc.pid,
        transport: proc.transport,
        startTime: proc.startTime,
        uptime: Date.now() - new Date(proc.startTime).getTime()
      });
    }
    return servers;
  }

  async checkServerHealth(serverName, port, transport = 'http', retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const healthUrl = transport === 'sse' 
          ? `http://localhost:${port}/sse?health=1`
          : `http://localhost:${port}/health`;
        
        const response = await fetch(healthUrl, {
          method: 'GET',
          timeout: 3000
        });
        
        if (response.ok) return true;
        
        // Wait before retry
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        // Wait before retry on network error
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    return false;
  }

  async getServerLogs(serverName, lines = 50) {
    const proc = this.processes.get(serverName);
    if (!proc) {
      throw new Error(`Server ${serverName} is not running`);
    }

    try {
      const logContent = await fs.readFile(proc.logFile, 'utf-8');
      const logLines = logContent.split('\n');
      return logLines.slice(-lines).join('\n');
    } catch (error) {
      return `Error reading logs: ${error.message}`;
    }
  }

  async findAvailablePort(startPort = 3000, endPort = 3100) {
    const usedPorts = new Set();
    for (const [, proc] of this.processes) {
      usedPorts.add(proc.port);
    }

    for (let port = startPort; port <= endPort; port++) {
      if (!usedPorts.has(port)) {
        // Also check if port is actually available
        const isAvailable = await this.isPortAvailable(port);
        if (isAvailable) {
          return port;
        }
      }
    }
    throw new Error(`No available ports in range ${startPort}-${endPort}`);
  }

  async isPortAvailable(port) {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        method: 'GET',
        timeout: 1000
      });
      return false; // Port is in use
    } catch {
      return true; // Port is available
    }
  }

  async restartServer(serverName, server, options) {
    const proc = this.processes.get(serverName);
    if (proc) {
      // Preserve settings from running server
      const { port, transport, envVars } = proc;
      await this.stopHttpServer(serverName);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
      return this.startHttpServer(serverName, server, {
        port,
        transport,
        envVars,
        ...options
      });
    } else {
      throw new Error(`Server ${serverName} is not running`);
    }
  }

  getProcessInfo(serverName) {
    return this.processes.get(serverName);
  }
}

// Export singleton instance
export default new ProcessManager();