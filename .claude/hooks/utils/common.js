/**
 * Common utilities for MCP Hub hooks
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract server name from file path
 */
function extractServerName(filePath) {
  if (!filePath.includes('mcp-hub/servers/')) {
    return null;
  }
  
  const pathParts = filePath.split('/');
  const serverIndex = pathParts.indexOf('servers');
  return pathParts[serverIndex + 1] || null;
}

/**
 * Load registry safely
 */
function loadRegistry(projectDir) {
  const registryPath = path.join(projectDir, 'mcp-hub', 'hub', 'registry.json');
  
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    return null;
  }
}

/**
 * Get server configuration from registry
 */
function getServerConfig(serverName, projectDir) {
  const registry = loadRegistry(projectDir);
  return registry?.servers?.[serverName] || null;
}

/**
 * Load hook state
 */
function loadState(stateFile) {
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
  } catch (error) {
    // State file might be corrupted
  }
  
  return {};
}

/**
 * Save hook state
 */
function saveState(stateFile, state) {
  try {
    const stateDir = path.dirname(stateFile);
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if file exists safely
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Read file safely
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

/**
 * Detect server type from directory contents
 */
function detectServerType(serverDir) {
  if (fileExists(path.join(serverDir, 'pyproject.toml'))) {
    return 'python';
  }
  if (fileExists(path.join(serverDir, 'package.json'))) {
    return 'node';
  }
  return 'unknown';
}

/**
 * Detect package manager
 */
function detectPackageManager(serverDir, serverType) {
  if (serverType === 'python') {
    return 'uv'; // Default to uv for Python
  }
  
  // Check for pnpm
  if (fileExists(path.join(serverDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  
  // Check for yarn
  if (fileExists(path.join(serverDir, 'yarn.lock'))) {
    return 'yarn';
  }
  
  // Default to npm
  return 'npm';
}

/**
 * Format message with emojis and structure
 */
function formatMessage(title, sections) {
  let message = `\n${title}\n\n`;
  
  for (const [key, value] of Object.entries(sections)) {
    if (Array.isArray(value) && value.length > 0) {
      message += `${key}:\n`;
      message += value.map(item => `  ${item}`).join('\n');
      message += '\n\n';
    } else if (typeof value === 'string') {
      message += `${key}: ${value}\n\n`;
    }
  }
  
  return message.trim();
}

/**
 * Standard hook response
 */
function createResponse(blocked = false, message = '', metadata = {}) {
  return JSON.stringify({
    blocked,
    message,
    metadata
  });
}

/**
 * Check if path is in servers directory
 */
function isServerPath(filePath) {
  return filePath.includes('mcp-hub/servers/');
}

/**
 * Get project directory
 */
function getProjectDir() {
  return process.env.CLAUDE_PROJECT_DIR || '.';
}

module.exports = {
  extractServerName,
  loadRegistry,
  getServerConfig,
  loadState,
  saveState,
  fileExists,
  readFile,
  detectServerType,
  detectPackageManager,
  formatMessage,
  createResponse,
  isServerPath,
  getProjectDir
};