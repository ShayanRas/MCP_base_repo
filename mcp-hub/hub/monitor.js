import chalk from 'chalk';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import processManager from './process-manager.js';
import fetch from 'node-fetch';

export class MonitorService {
  constructor() {
    this.screen = null;
    this.grid = null;
    this.widgets = {};
    this.updateInterval = null;
    this.selectedServer = null;
  }

  async start() {
    // Create blessed screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'MCP Server Monitor'
    });

    // Create grid layout
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Create widgets
    this.createWidgets();

    // Set up keyboard controls
    this.setupKeyboardControls();

    // Start update loop
    this.startUpdateLoop();

    // Initial render
    this.screen.render();
  }

  createWidgets() {
    // Server list (left side)
    this.widgets.serverList = this.grid.set(0, 0, 12, 4, blessed.list, {
      label: ' Running Servers ',
      keys: true,
      vi: true,
      style: {
        selected: {
          bg: 'blue',
          fg: 'white'
        },
        border: {
          fg: 'cyan'
        }
      },
      border: {
        type: 'line'
      }
    });

    // Server details (top right)
    this.widgets.serverDetails = this.grid.set(0, 4, 4, 8, blessed.box, {
      label: ' Server Details ',
      content: 'Select a server to view details',
      style: {
        border: {
          fg: 'cyan'
        }
      },
      border: {
        type: 'line'
      }
    });

    // Performance metrics (middle right)
    this.widgets.metrics = this.grid.set(4, 4, 4, 4, contrib.line, {
      label: ' Request Rate ',
      showLegend: true,
      style: {
        border: {
          fg: 'cyan'
        },
        line: 'yellow',
        text: 'green',
        baseline: 'black'
      },
      border: {
        type: 'line'
      }
    });

    // Health status (middle right, next to metrics)
    this.widgets.healthStatus = this.grid.set(4, 8, 4, 4, blessed.box, {
      label: ' Health Status ',
      content: '',
      style: {
        border: {
          fg: 'cyan'
        }
      },
      border: {
        type: 'line'
      }
    });

    // Logs (bottom right)
    this.widgets.logs = this.grid.set(8, 4, 4, 8, blessed.log, {
      label: ' Server Logs ',
      keys: true,
      vi: true,
      scrollable: true,
      alwaysScroll: true,
      style: {
        border: {
          fg: 'cyan'
        }
      },
      border: {
        type: 'line'
      }
    });

    // Set up server list selection
    this.widgets.serverList.on('select', (item, index) => {
      const servers = processManager.getRunningServers();
      if (servers[index]) {
        this.selectedServer = servers[index].name;
        this.updateServerDetails(servers[index]);
        this.loadServerLogs(servers[index].name);
      }
    });
  }

  setupKeyboardControls() {
    // Quit on q or ESC
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.stop();
      process.exit(0);
    });

    // Refresh on r
    this.screen.key(['r'], () => {
      this.updateAll();
      this.screen.render();
    });

    // Stop selected server on s
    this.screen.key(['s'], async () => {
      if (this.selectedServer) {
        await this.stopServer(this.selectedServer);
      }
    });

    // Restart selected server on R
    this.screen.key(['R'], async () => {
      if (this.selectedServer) {
        await this.restartServer(this.selectedServer);
      }
    });

    // Tab between widgets
    this.screen.key(['tab'], () => {
      const widgets = [
        this.widgets.serverList,
        this.widgets.logs
      ];
      const currentIndex = widgets.findIndex(w => w === this.screen.focused);
      const nextIndex = (currentIndex + 1) % widgets.length;
      widgets[nextIndex].focus();
      this.screen.render();
    });
  }

  startUpdateLoop() {
    // Update every 2 seconds
    this.updateInterval = setInterval(() => {
      this.updateAll();
    }, 2000);

    // Initial update
    this.updateAll();
  }

  async updateAll() {
    const servers = processManager.getRunningServers();
    
    // Update server list
    this.updateServerList(servers);

    // Update selected server details
    if (this.selectedServer) {
      const server = servers.find(s => s.name === this.selectedServer);
      if (server) {
        this.updateServerDetails(server);
        await this.checkServerHealth(server);
      } else {
        this.selectedServer = null;
        this.widgets.serverDetails.setContent('Server no longer running');
      }
    }

    // Update metrics
    this.updateMetrics();

    this.screen.render();
  }

  updateServerList(servers) {
    const items = servers.map(server => {
      const uptime = this.formatUptime(server.uptime);
      const status = server.healthy ? chalk.green('●') : chalk.red('●');
      return `${status} ${server.name} :${server.port} (${uptime})`;
    });

    if (items.length === 0) {
      items.push(chalk.gray('No servers running'));
    }

    this.widgets.serverList.setItems(items);
  }

  updateServerDetails(server) {
    const uptime = this.formatUptime(server.uptime);
    const details = [
      `${chalk.bold('Name:')} ${server.name}`,
      `${chalk.bold('Port:')} ${server.port}`,
      `${chalk.bold('Transport:')} ${server.transport}`,
      `${chalk.bold('PID:')} ${server.pid}`,
      `${chalk.bold('Started:')} ${new Date(server.startTime).toLocaleString()}`,
      `${chalk.bold('Uptime:')} ${uptime}`,
      '',
      chalk.gray('Press [s] to stop, [R] to restart')
    ].join('\n');

    this.widgets.serverDetails.setContent(details);
  }

  async checkServerHealth(server) {
    const isHealthy = await processManager.checkServerHealth(
      server.name,
      server.port,
      server.transport
    );

    const status = isHealthy 
      ? chalk.green('✓ Healthy')
      : chalk.red('✗ Unhealthy');

    const healthInfo = [
      status,
      '',
      `${chalk.bold('Endpoint:')} http://localhost:${server.port}`,
      `${chalk.bold('Health Check:')} ${isHealthy ? 'Passing' : 'Failing'}`
    ].join('\n');

    this.widgets.healthStatus.setContent(healthInfo);
  }

  async loadServerLogs(serverName) {
    try {
      const logs = await processManager.getServerLogs(serverName, 100);
      const logLines = logs.split('\n');
      
      // Clear existing logs
      this.widgets.logs.setContent('');
      
      // Add new logs
      logLines.forEach(line => {
        // Color code based on log level
        if (line.includes('[ERROR]')) {
          this.widgets.logs.log(chalk.red(line));
        } else if (line.includes('[WARN]')) {
          this.widgets.logs.log(chalk.yellow(line));
        } else if (line.includes('[INFO]')) {
          this.widgets.logs.log(chalk.blue(line));
        } else {
          this.widgets.logs.log(line);
        }
      });
    } catch (error) {
      this.widgets.logs.log(chalk.red(`Error loading logs: ${error.message}`));
    }
  }

  updateMetrics() {
    // Placeholder for metrics - in production this would track actual request rates
    const data = {
      title: 'Requests/sec',
      x: Array.from({length: 60}, (_, i) => 60 - i + 's'),
      y: Array.from({length: 60}, () => Math.floor(Math.random() * 10))
    };

    this.widgets.metrics.setData([data]);
  }

  async stopServer(serverName) {
    try {
      this.widgets.logs.log(chalk.yellow(`Stopping server ${serverName}...`));
      await processManager.stopHttpServer(serverName);
      this.widgets.logs.log(chalk.green(`Server ${serverName} stopped`));
      this.updateAll();
    } catch (error) {
      this.widgets.logs.log(chalk.red(`Failed to stop server: ${error.message}`));
    }
  }

  async restartServer(serverName) {
    try {
      this.widgets.logs.log(chalk.yellow(`Restarting server ${serverName}...`));
      const server = processManager.getProcessInfo(serverName);
      if (server) {
        const manager = await import('./manager.js');
        await processManager.restartServer(serverName, manager.default.getServer(serverName), {});
        this.widgets.logs.log(chalk.green(`Server ${serverName} restarted`));
        this.updateAll();
      }
    } catch (error) {
      this.widgets.logs.log(chalk.red(`Failed to restart server: ${error.message}`));
    }
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.screen) {
      this.screen.destroy();
    }
  }
}

// Simple monitor display (non-interactive)
export const displayMonitor = async () => {
  const servers = processManager.getRunningServers();
  
  console.log(chalk.bold('\n📊 MCP HTTP Server Monitor\n'));
  console.log(chalk.gray('─'.repeat(60)));
  
  if (servers.length === 0) {
    console.log(chalk.gray('No HTTP servers currently running'));
    return;
  }

  for (const server of servers) {
    const uptime = formatUptime(server.uptime);
    const isHealthy = await processManager.checkServerHealth(
      server.name,
      server.port,
      server.transport
    );
    const status = isHealthy ? chalk.green('●') : chalk.red('●');
    
    console.log(`${status} ${chalk.bold(server.name)}`);
    console.log(`   Port: ${server.port}`);
    console.log(`   Transport: ${server.transport}`);
    console.log(`   PID: ${server.pid}`);
    console.log(`   Uptime: ${uptime}`);
    console.log(`   Health: ${isHealthy ? chalk.green('Healthy') : chalk.red('Unhealthy')}`);
    console.log(`   URL: http://localhost:${server.port}${server.transport === 'sse' ? '/sse' : '/mcp'}`);
    console.log('');
  }
  
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.gray('Use "mcp monitor --interactive" for live dashboard'));
};

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export default MonitorService;