#!/usr/bin/env node

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express, { Request, Response } from 'express';
import { parseArgs } from 'node:util';
import packageJson from '../../package.json' with { type: 'json' };
import { createSupabaseApiPlatform } from '../platform/api-platform.js';
import { createSupabaseMcpServer } from '../server.js';
import { parseList } from './util.js';

const { version } = packageJson;

console.error('Starting Supabase SSE server...');

const app = express();
const transports: Map<string, SSEServerTransport> = new Map<string, SSEServerTransport>();

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

  app.get('/sse', async (req: Request, res: Response) => {
    let transport: SSEServerTransport;
    
    if (req?.query?.sessionId) {
      const sessionId = req?.query?.sessionId as string;
      transport = transports.get(sessionId) as SSEServerTransport;
      console.error("Client Reconnecting? This shouldn't happen; when client has a sessionId, GET /sse should not be called again.", transport.sessionId);
    } else {
      // Create platform and server for new session
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

      // Create and store transport for new session
      transport = new SSEServerTransport('/message', res);
      transports.set(transport.sessionId, transport);

      // Connect server to transport
      await server.connect(transport);
      console.error("Client Connected: ", transport.sessionId);

      // Handle close of connection
      server.onclose = async () => {
        console.error("Client Disconnected: ", transport.sessionId);
        transports.delete(transport.sessionId);
      };
    }
  });

  app.post('/message', async (req: Request, res: Response) => {
    const sessionId = req?.query?.sessionId as string;
    const transport = transports.get(sessionId);
    if (transport) {
      console.error("Client Message from", sessionId);
      await transport.handlePostMessage(req, res);
    } else {
      console.error(`No transport found for sessionId ${sessionId}`);
      res.status(404).json({ error: 'Session not found' });
    }
  });

  const PORT = cliPort || process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.error(`Supabase MCP SSE Server running on port ${PORT}`);
    console.error(`Connect via: http://localhost:${PORT}/sse`);
  });
}

main().catch(console.error);