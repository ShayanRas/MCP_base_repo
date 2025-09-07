import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_CONFIG_FILE = path.join(__dirname, '..', '.mcp-auth.json');

export class AuthManager {
  constructor() {
    this.authTokens = new Map();
    this.serverTokens = new Map();
    this.loadAuthConfig();
  }

  async loadAuthConfig() {
    try {
      const data = await fs.readFile(AUTH_CONFIG_FILE, 'utf-8');
      const config = JSON.parse(data);
      
      // Load server-specific tokens
      for (const [serverName, token] of Object.entries(config.serverTokens || {})) {
        this.serverTokens.set(serverName, token);
      }
      
      // Load global tokens
      for (const token of (config.globalTokens || [])) {
        this.authTokens.set(token.token, token);
      }
    } catch (error) {
      // Config doesn't exist yet, that's fine
      this.authTokens = new Map();
      this.serverTokens = new Map();
    }
  }

  async saveAuthConfig() {
    const config = {
      serverTokens: Object.fromEntries(this.serverTokens),
      globalTokens: Array.from(this.authTokens.values())
    };
    
    await fs.writeFile(AUTH_CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  generateApiKey(name = 'default') {
    const token = `mcp_${crypto.randomBytes(32).toString('hex')}`;
    const tokenData = {
      token,
      name,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      permissions: ['*']
    };
    
    this.authTokens.set(token, tokenData);
    this.saveAuthConfig();
    return token;
  }

  generateServerToken(serverName) {
    const token = `mcp_srv_${crypto.randomBytes(24).toString('hex')}`;
    this.serverTokens.set(serverName, token);
    this.saveAuthConfig();
    return token;
  }

  validateToken(token, serverName = null) {
    // Check server-specific token first
    if (serverName && this.serverTokens.has(serverName)) {
      if (this.serverTokens.get(serverName) === token) {
        return { valid: true, serverSpecific: true };
      }
    }
    
    // Check global tokens
    if (this.authTokens.has(token)) {
      const tokenData = this.authTokens.get(token);
      tokenData.lastUsed = new Date().toISOString();
      this.saveAuthConfig();
      return { valid: true, data: tokenData };
    }
    
    return { valid: false };
  }

  revokeToken(token) {
    const deleted = this.authTokens.delete(token);
    if (deleted) {
      this.saveAuthConfig();
    }
    return deleted;
  }

  listTokens() {
    return {
      global: Array.from(this.authTokens.values()).map(t => ({
        name: t.name,
        createdAt: t.createdAt,
        lastUsed: t.lastUsed,
        tokenPreview: t.token.substring(0, 12) + '...'
      })),
      servers: Array.from(this.serverTokens.entries()).map(([server, token]) => ({
        server,
        tokenPreview: token.substring(0, 12) + '...'
      }))
    };
  }

  createExpressMiddleware(serverName = null, optional = false) {
    return (req, res, next) => {
      // Skip auth for health checks
      if (req.path === '/health') {
        return next();
      }
      
      // Extract token from header or query
      const token = req.headers['authorization']?.replace('Bearer ', '') ||
                   req.query.token;
      
      if (!token) {
        if (optional) {
          // Auth is optional, continue without authentication
          req.authenticated = false;
          return next();
        }
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide an API token in Authorization header or token query parameter'
        });
      }
      
      const validation = this.validateToken(token, serverName);
      
      if (!validation.valid) {
        return res.status(403).json({
          error: 'Invalid token',
          message: 'The provided authentication token is invalid'
        });
      }
      
      // Attach auth info to request
      req.authenticated = true;
      req.authData = validation.data || { serverSpecific: true };
      next();
    };
  }

  createWebSocketMiddleware(serverName = null, optional = false) {
    return (ws, req) => {
      // Extract token from query or first message
      const token = req.query?.token;
      
      if (!token && !optional) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Authentication required',
          message: 'Please provide token in connection URL'
        }));
        ws.close(1008, 'Authentication required');
        return false;
      }
      
      if (token) {
        const validation = this.validateToken(token, serverName);
        
        if (!validation.valid) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid token',
            message: 'The provided authentication token is invalid'
          }));
          ws.close(1008, 'Invalid token');
          return false;
        }
        
        ws.authenticated = true;
        ws.authData = validation.data || { serverSpecific: true };
      } else {
        ws.authenticated = false;
      }
      
      return true;
    };
  }
}

// CLI functions for auth management
export const manageAuth = async (inquirer) => {
  const authManager = new AuthManager();
  await authManager.loadAuthConfig();
  
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Authentication Management:',
    choices: [
      { name: '🔑 Generate new API key', value: 'generate' },
      { name: '🔒 Generate server-specific token', value: 'server-token' },
      { name: '📋 List all tokens', value: 'list' },
      { name: '❌ Revoke a token', value: 'revoke' },
      { name: '⬅️ Back to main menu', value: 'back' }
    ]
  }]);
  
  switch (action) {
    case 'generate':
      const { keyName } = await inquirer.prompt([{
        type: 'input',
        name: 'keyName',
        message: 'Name for this API key:',
        default: 'default'
      }]);
      
      const token = authManager.generateApiKey(keyName);
      console.log(chalk.green('\n✅ API Key generated successfully!'));
      console.log(chalk.yellow('⚠️  Save this token securely, it will not be shown again:'));
      console.log(chalk.cyan(token));
      console.log(chalk.gray('\nUse this token in the Authorization header:'));
      console.log(chalk.gray('Authorization: Bearer ' + token));
      break;
      
    case 'server-token':
      const { serverName } = await inquirer.prompt([{
        type: 'input',
        name: 'serverName',
        message: 'Server name for this token:',
        validate: (input) => input.length > 0 || 'Server name is required'
      }]);
      
      const serverToken = authManager.generateServerToken(serverName);
      console.log(chalk.green(`\n✅ Server token for ${serverName} generated!`));
      console.log(chalk.yellow('⚠️  Save this token securely:'));
      console.log(chalk.cyan(serverToken));
      break;
      
    case 'list':
      const tokens = authManager.listTokens();
      
      console.log(chalk.bold('\n🔑 Global API Keys:'));
      if (tokens.global.length === 0) {
        console.log(chalk.gray('  No global tokens'));
      } else {
        tokens.global.forEach(t => {
          console.log(`  ${t.name}: ${t.tokenPreview}`);
          console.log(chalk.gray(`    Created: ${t.createdAt}`));
          if (t.lastUsed) {
            console.log(chalk.gray(`    Last used: ${t.lastUsed}`));
          }
        });
      }
      
      console.log(chalk.bold('\n🔒 Server-Specific Tokens:'));
      if (tokens.servers.length === 0) {
        console.log(chalk.gray('  No server tokens'));
      } else {
        tokens.servers.forEach(t => {
          console.log(`  ${t.server}: ${t.tokenPreview}`);
        });
      }
      break;
      
    case 'revoke':
      const allTokens = authManager.listTokens();
      const tokenChoices = [
        ...allTokens.global.map(t => ({
          name: `Global: ${t.name} (${t.tokenPreview})`,
          value: { type: 'global', name: t.name }
        })),
        ...allTokens.servers.map(t => ({
          name: `Server: ${t.server} (${t.tokenPreview})`,
          value: { type: 'server', server: t.server }
        }))
      ];
      
      if (tokenChoices.length === 0) {
        console.log(chalk.gray('\nNo tokens to revoke'));
        break;
      }
      
      const { toRevoke } = await inquirer.prompt([{
        type: 'list',
        name: 'toRevoke',
        message: 'Select token to revoke:',
        choices: tokenChoices
      }]);
      
      if (toRevoke.type === 'global') {
        // Find and revoke the global token
        const token = Array.from(authManager.authTokens.values())
          .find(t => t.name === toRevoke.name);
        if (token) {
          authManager.revokeToken(token.token);
          console.log(chalk.green(`✅ Revoked token: ${toRevoke.name}`));
        }
      } else {
        // Revoke server token
        authManager.serverTokens.delete(toRevoke.server);
        await authManager.saveAuthConfig();
        console.log(chalk.green(`✅ Revoked server token for: ${toRevoke.server}`));
      }
      break;
  }
};

export default new AuthManager();