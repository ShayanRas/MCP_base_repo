#!/usr/bin/env node

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import packageJson from '../../package.json' with { type: 'json' };
import { createSupabaseApiPlatform } from '../platform/api-platform.js';
import { createSupabaseMcpServer } from '../server.js';
import { parseList } from './util.js';

const { version } = packageJson;

console.error('Starting Supabase Streamable HTTP server...');

const app = express();
const transports: Map<string, StreamableHTTPServerTransport> = new Map<string, StreamableHTTPServerTransport>();
const servers: Map<string, any> = new Map<string, any>();

async function main() {
  const {
    values: {
      ['access-token']: cliAccessToken,
      ['project-ref']: projectId,
      ['read-only']: readOnly,
      ['api-url']: apiUrl,
      ['version']: showVersion,
      ['features']: cliFeatures,
      ['port']: cliPort,
    },
  } = parseArgs({
    options: {
      ['access-token']: { type: 'string' },
      ['project-ref']: { type: 'string' },
      ['read-only']: { type: 'boolean', default: false },
      ['api-url']: { type: 'string' },
      ['version']: { type: 'boolean' },
      ['features']: { type: 'string' },
      ['port']: { type: 'string' },
    },
  });

  if (showVersion) {
    console.log(version);
    process.exit(0);
  }

  const accessToken = cliAccessToken ?? process.env.SUPABASE_ACCESS_TOKEN;

  if (!accessToken) {
    console.error(
      'Please provide a personal access token (PAT) with the --access-token flag or set the SUPABASE_ACCESS_TOKEN environment variable'
    );
    process.exit(1);
  }

  const features = cliFeatures ? parseList(cliFeatures) : undefined;

  app.post('/mcp', async (req: Request, res: Response) => {
    console.error('Received MCP POST request');
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        // Reuse existing transport
        transport = transports.get(sessionId)!;
      } else if (!sessionId) {
        // New initialization request
        const platform = createSupabaseApiPlatform({
          accessToken,
          apiUrl,
        });

        const server = createSupabaseMcpServer({
          platform,
          projectId,
          readOnly,
          features,
        });

        const eventStore = new InMemoryEventStore();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore, // Enable resumability
          onsessioninitialized: (sessionId: string) => {
            console.error(`Session initialized with ID: ${sessionId}`);
            transports.set(sessionId, transport);
            servers.set(sessionId, server);
          }
        });

        // Set up onclose handler to clean up transport when closed
        server.onclose = async () => {
          const sid = transport.sessionId;
          if (sid && transports.has(sid)) {
            console.error(`Transport closed for session ${sid}, removing from transports map`);
            transports.delete(sid);
            servers.delete(sid);
          }
        };

        // Connect the transport to the MCP server
        await server.connect(transport);

        await transport.handleRequest(req, res);
        return;
      } else {
        // Invalid request - no session ID or not initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: req?.body?.id,
        });
        return;
      }

      // Handle the request with existing transport
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: req?.body?.id,
        });
      }
    }
  });

  // Handle GET requests for SSE streams
  app.get('/mcp', async (req: Request, res: Response) => {
    console.error('Received MCP GET request');
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: req?.body?.id,
      });
      return;
    }

    // Check for Last-Event-ID header for resumability
    const lastEventId = req.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
      console.error(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
      console.error(`Establishing new SSE stream for session ${sessionId}`);
    }

    const transport = transports.get(sessionId);
    await transport!.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: req?.body?.id,
      });
      return;
    }

    console.error(`Received session termination request for session ${sessionId}`);

    try {
      const transport = transports.get(sessionId);
      await transport!.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling session termination:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Error handling session termination',
          },
          id: req?.body?.id,
        });
      }
    }
  });

  // Start the server
  const PORT = cliPort || process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.error(`Supabase MCP Streamable HTTP Server listening on port ${PORT}`);
    console.error(`Connect via: http://localhost:${PORT}/mcp`);
  });

  // Handle server shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down server...');

    // Close all active transports
    for (const [sessionId, transport] of transports) {
      try {
        console.error(`Closing transport for session ${sessionId}`);
        await transport.close();
        transports.delete(sessionId);
        servers.delete(sessionId);
      } catch (error) {
        console.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }

    console.error('Server shutdown complete');
    process.exit(0);
  });
}

main().catch(console.error);