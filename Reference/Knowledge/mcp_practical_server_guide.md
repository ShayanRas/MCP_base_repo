# Building Production MCP Servers: A Practical Engineering Guide

## Table of Contents
1. [Server Architecture Fundamentals](#server-architecture-fundamentals)
2. [Complete Server Implementation](#complete-server-implementation)
3. [Tool Implementation Patterns](#tool-implementation-patterns)
4. [Resource Management](#resource-management)
5. [Prompt Engineering](#prompt-engineering)
6. [Transport Layer Implementation](#transport-layer-implementation)
7. [Advanced Features](#advanced-features)
8. [Production Considerations](#production-considerations)
9. [Testing and Debugging](#testing-and-debugging)
10. [Real-World Patterns](#real-world-patterns)

---

## Chapter 1: Server Architecture Fundamentals

### 1.1 Core Server Structure

Every MCP server follows a fundamental architecture pattern. Let's dissect the production-ready structure from the "everything" server:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const createServer = () => {
  const server = new Server(
    {
      name: "your-domain-server",
      title: "Your Domain MCP Server", 
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
        logging: {},
        completions: {}
      },
      instructions: "Server-specific instructions for the LLM"
    }
  );
  
  // State management
  let subscriptions: Set<string> = new Set();
  let clientCapabilities: ClientCapabilities | undefined;
  
  // Cleanup function for graceful shutdown
  const cleanup = async () => {
    // Clean up timers, connections, etc.
  };
  
  return { server, cleanup };
};
```

**Key Architectural Decisions:**

1. **Factory Pattern**: Using `createServer()` function allows multiple server instances
2. **Capability Declaration**: Explicitly declare what your server supports
3. **State Isolation**: Each server instance maintains its own state
4. **Cleanup Strategy**: Always provide cleanup for graceful shutdown

### 1.2 Initialization Lifecycle

The server initialization follows a specific sequence:

```typescript
server.oninitialized = async () => {
  // Called after successful connection
  clientCapabilities = server.getClientCapabilities();
  
  // Check for optional capabilities
  if (clientCapabilities?.roots) {
    // Initialize roots-specific features
    const response = await server.listRoots();
    currentRoots = response.roots;
  }
  
  if (clientCapabilities?.elicitation) {
    // Enable elicitation features
  }
  
  // Start any background processes
  startNotificationIntervals();
};
```

### 1.3 Request Handler Architecture

MCP servers use typed request handlers with schema validation:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  // Handler implementation
  return { tools: availableTools };
});
```

---

## Chapter 2: Complete Server Implementation

### 2.1 Full Server Skeleton

Here's a production-ready server skeleton based on the "everything" server patterns:

```typescript
// everything.ts - Main server implementation
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CompleteRequestSchema,
  SetLevelRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  RootsListChangedNotificationSchema,
  ClientCapabilities,
  LoggingLevel,
  Tool,
  Resource,
  type Root,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Tool input schemas using Zod for validation
const EchoSchema = z.object({
  message: z.string().describe("Message to echo"),
});

const AddSchema = z.object({
  a: z.number().describe("First number"),
  b: z.number().describe("Second number"),
});

const LongRunningOperationSchema = z.object({
  duration: z
    .number()
    .default(10)
    .describe("Duration of the operation in seconds"),
  steps: z
    .number()
    .default(5)
    .describe("Number of steps in the operation"),
});

// Enum for tool names (type safety)
enum ToolName {
  ECHO = "echo",
  ADD = "add",
  LONG_RUNNING = "longRunningOperation",
}

// Enum for prompt names
enum PromptName {
  SIMPLE = "simple_prompt",
  COMPLEX = "complex_prompt",
  RESOURCE = "resource_prompt",
}

export const createServer = () => {
  const server = new Server(
    {
      name: "production-mcp-server",
      title: "Production MCP Server",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
        logging: {},
        completions: {}
      },
      instructions: "Production server with full MCP capabilities"
    }
  );

  // State management
  let subscriptions: Set<string> = new Set();
  let logLevel: LoggingLevel = "info";
  let clientCapabilities: ClientCapabilities | undefined;
  let currentRoots: Root[] = [];
  
  // Notification intervals
  let subsUpdateInterval: NodeJS.Timeout | undefined;
  let logsUpdateInterval: NodeJS.Timeout | undefined;

  // Tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
      {
        name: ToolName.ECHO,
        description: "Echoes back the input",
        inputSchema: zodToJsonSchema(EchoSchema) as ToolInput,
      },
      {
        name: ToolName.ADD,
        description: "Adds two numbers",
        inputSchema: zodToJsonSchema(AddSchema) as ToolInput,
      },
      {
        name: ToolName.LONG_RUNNING,
        description: "Demonstrates long running operation with progress",
        inputSchema: zodToJsonSchema(LongRunningOperationSchema) as ToolInput,
      },
    ];
    
    // Conditionally add tools based on client capabilities
    if (clientCapabilities?.roots) {
      tools.push({
        name: "listRoots",
        description: "Lists available filesystem roots",
        inputSchema: zodToJsonSchema(z.object({})) as ToolInput,
      });
    }
    
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    switch (name) {
      case ToolName.ECHO: {
        const validated = EchoSchema.parse(args);
        return {
          content: [{ 
            type: "text", 
            text: `Echo: ${validated.message}` 
          }],
        };
      }
      
      case ToolName.ADD: {
        const validated = AddSchema.parse(args);
        return {
          content: [{
            type: "text",
            text: `Sum: ${validated.a + validated.b}`,
          }],
        };
      }
      
      case ToolName.LONG_RUNNING: {
        const validated = LongRunningOperationSchema.parse(args);
        const { duration, steps } = validated;
        const progressToken = request.params._meta?.progressToken;
        
        for (let i = 1; i <= steps; i++) {
          await new Promise(resolve => 
            setTimeout(resolve, (duration / steps) * 1000)
          );
          
          if (progressToken) {
            await server.notification({
              method: "notifications/progress",
              params: {
                progress: i,
                total: steps,
                progressToken,
              },
            });
          }
        }
        
        return {
          content: [{
            type: "text",
            text: `Operation completed: ${duration}s, ${steps} steps`,
          }],
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
  
  // Resource management
  const ALL_RESOURCES: Resource[] = Array.from({ length: 100 }, (_, i) => {
    const id = i + 1;
    const uri = `resource://example/${id}`;
    
    if (id % 2 === 0) {
      return {
        uri,
        name: `Resource ${id}`,
        mimeType: "text/plain",
        text: `Content of resource ${id}`,
      };
    } else {
      const buffer = Buffer.from(`Binary data for resource ${id}`);
      return {
        uri,
        name: `Resource ${id}`,
        mimeType: "application/octet-stream",
        blob: buffer.toString("base64"),
      };
    }
  });
  
  const PAGE_SIZE = 10;
  
  server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
    const cursor = request.params?.cursor;
    let startIndex = 0;
    
    if (cursor) {
      startIndex = parseInt(atob(cursor), 10) || 0;
    }
    
    const endIndex = Math.min(startIndex + PAGE_SIZE, ALL_RESOURCES.length);
    const resources = ALL_RESOURCES.slice(startIndex, endIndex);
    
    const nextCursor = endIndex < ALL_RESOURCES.length 
      ? btoa(endIndex.toString()) 
      : undefined;
    
    return { resources, nextCursor };
  });
  
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const resource = ALL_RESOURCES.find(r => r.uri === uri);
    
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    return { contents: [resource] };
  });
  
  // Subscription handling
  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    const { uri } = request.params;
    subscriptions.add(uri);
    
    // Start update notifications if first subscription
    if (subscriptions.size === 1) {
      subsUpdateInterval = setInterval(() => {
        for (const subscribedUri of subscriptions) {
          server.notification({
            method: "notifications/resources/updated",
            params: { uri: subscribedUri },
          });
        }
      }, 10000); // Update every 10 seconds
    }
    
    return {};
  });
  
  server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    subscriptions.delete(request.params.uri);
    
    // Stop notifications if no more subscriptions
    if (subscriptions.size === 0 && subsUpdateInterval) {
      clearInterval(subsUpdateInterval);
      subsUpdateInterval = undefined;
    }
    
    return {};
  });
  
  // Prompt handling
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: PromptName.SIMPLE,
          description: "A simple prompt without arguments",
        },
        {
          name: PromptName.COMPLEX,
          description: "A complex prompt with arguments",
          arguments: [
            {
              name: "temperature",
              description: "Temperature setting",
              required: true,
            },
            {
              name: "style",
              description: "Output style",
              required: false,
            },
          ],
        },
      ],
    };
  });
  
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (name === PromptName.SIMPLE) {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "This is a simple prompt.",
            },
          },
        ],
      };
    }
    
    if (name === PromptName.COMPLEX) {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Complex prompt with temperature=${args?.temperature}, style=${args?.style}`,
            },
          },
        ],
      };
    }
    
    throw new Error(`Unknown prompt: ${name}`);
  });
  
  // Completion support
  server.setRequestHandler(CompleteRequestSchema, async (request) => {
    const { ref, argument } = request.params;
    
    const completions = {
      temperature: ["0", "0.5", "0.7", "1.0"],
      style: ["casual", "formal", "technical"],
    };
    
    if (ref.type === "ref/prompt" && argument.name in completions) {
      const values = completions[argument.name as keyof typeof completions]
        .filter(v => v.startsWith(argument.value));
      
      return { 
        completion: { 
          values, 
          hasMore: false, 
          total: values.length 
        } 
      };
    }
    
    return { completion: { values: [] } };
  });
  
  // Logging configuration
  server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    logLevel = request.params.level;
    
    await server.notification({
      method: "notifications/message",
      params: {
        level: "info",
        logger: "mcp-server",
        data: `Log level set to: ${logLevel}`,
      },
    });
    
    return {};
  });
  
  // Roots protocol support
  server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
    try {
      const response = await server.listRoots();
      if (response && 'roots' in response) {
        currentRoots = response.roots;
      }
    } catch (error) {
      console.error("Failed to update roots:", error);
    }
  });
  
  // Initialization handler
  server.oninitialized = async () => {
    clientCapabilities = server.getClientCapabilities();
    
    if (clientCapabilities?.roots) {
      try {
        const response = await server.listRoots();
        if (response && 'roots' in response) {
          currentRoots = response.roots;
        }
      } catch (error) {
        console.error("Failed to get initial roots:", error);
      }
    }
  };
  
  // Cleanup function
  const cleanup = async () => {
    if (subsUpdateInterval) clearInterval(subsUpdateInterval);
    if (logsUpdateInterval) clearInterval(logsUpdateInterval);
  };
  
  return { server, cleanup };
};
```

### 2.2 Entry Point Implementation

The entry point manages transport selection and server lifecycle:

```typescript
// index.ts - Entry point with transport selection
#!/usr/bin/env node

const args = process.argv.slice(2);
const transport = args[0] || 'stdio';

async function run() {
  try {
    switch (transport) {
      case 'stdio':
        await import('./stdio.js');
        break;
      case 'sse':
        await import('./sse.js');
        break;
      case 'streamableHttp':
        await import('./streamableHttp.js');
        break;
      default:
        console.error(`Unknown transport: ${transport}`);
        console.log('Available transports: stdio, sse, streamableHttp');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error running server:', error);
    process.exit(1);
  }
}

run();
```

---

## Chapter 3: Tool Implementation Patterns

### 3.1 Basic Tool Pattern

Every tool follows this fundamental pattern:

```typescript
// 1. Define Zod schema for validation
const ToolSchema = z.object({
  param1: z.string().describe("Parameter description"),
  param2: z.number().min(0).max(100).describe("Numeric parameter"),
  optional: z.boolean().optional().describe("Optional parameter"),
});

// 2. Register tool in ListToolsRequestSchema handler
{
  name: "toolName",
  description: "What this tool does",
  inputSchema: zodToJsonSchema(ToolSchema) as ToolInput,
}

// 3. Implement handler in CallToolRequestSchema
case "toolName": {
  // Validate input
  const validated = ToolSchema.parse(args);
  
  // Perform operation
  const result = await performOperation(validated);
  
  // Return structured response
  return {
    content: [{
      type: "text",
      text: JSON.stringify(result),
    }],
  };
}
```

### 3.2 Advanced Tool Patterns

#### Progress Notifications

For long-running operations:

```typescript
const LongOperationSchema = z.object({
  duration: z.number().describe("Duration in seconds"),
  steps: z.number().describe("Number of steps"),
});

// In handler:
const progressToken = request.params._meta?.progressToken;

for (let i = 1; i <= steps; i++) {
  // Do work
  await doStep(i);
  
  // Send progress notification
  if (progressToken) {
    await server.notification({
      method: "notifications/progress",
      params: {
        progress: i,
        total: steps,
        progressToken,
      },
    });
  }
}
```

#### Multi-Modal Responses

Tools can return various content types:

```typescript
return {
  content: [
    {
      type: "text",
      text: "Here's the analysis:",
    },
    {
      type: "image",
      data: base64ImageData,
      mimeType: "image/png",
    },
    {
      type: "resource",
      resource: {
        uri: "resource://data/analysis",
        name: "Detailed Analysis",
        mimeType: "application/json",
        text: JSON.stringify(analysisData),
      },
    },
  ],
};
```

#### Annotated Content

Add metadata to content for client interpretation:

```typescript
return {
  content: [
    {
      type: "text",
      text: "Critical error occurred",
      annotations: {
        priority: 1.0, // High priority
        audience: ["user", "assistant"],
      },
    },
    {
      type: "text",
      text: "Debug info: stack trace...",
      annotations: {
        priority: 0.3, // Low priority
        audience: ["assistant"], // Only for AI
      },
    },
  ],
};
```

#### Structured Content

Return typed data with schema:

```typescript
const WeatherSchema = z.object({
  temperature: z.number(),
  conditions: z.string(),
  humidity: z.number(),
});

// Tool definition includes output schema
{
  name: "getWeather",
  description: "Get weather data",
  inputSchema: zodToJsonSchema(InputSchema) as ToolInput,
  outputSchema: zodToJsonSchema(WeatherSchema) as ToolOutput,
}

// Handler returns structured content
return {
  content: [{
    type: "text",
    text: JSON.stringify(weatherData), // Backward compatibility
  }],
  structuredContent: weatherData, // Typed data
};
```

### 3.3 Client Interaction Tools

#### Sampling (Request AI Completion)

```typescript
const requestSampling = async (
  context: string,
  maxTokens: number = 100
) => {
  const request: CreateMessageRequest = {
    method: "sampling/createMessage",
    params: {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: context,
          },
        },
      ],
      systemPrompt: "You are a helpful assistant.",
      maxTokens,
      temperature: 0.7,
      includeContext: "thisServer",
    },
  };
  
  const result = await server.request(request, CreateMessageResultSchema);
  return result.content.text;
};
```

#### Elicitation (Request User Input)

```typescript
const requestElicitation = async (
  message: string,
  schema: any
) => {
  const request = {
    method: 'elicitation/create',
    params: {
      message,
      requestedSchema: schema
    }
  };
  
  const result = await server.request(request, z.any());
  
  if (result.action === 'accept' && result.content) {
    return result.content; // User provided data
  } else if (result.action === 'decline') {
    throw new Error('User declined to provide information');
  } else {
    throw new Error('User cancelled elicitation');
  }
};

// Usage in tool
const userPreferences = await requestElicitation(
  'Please provide your preferences',
  {
    type: 'object',
    properties: {
      theme: { 
        type: 'string', 
        enum: ['light', 'dark'] 
      },
      language: { 
        type: 'string' 
      },
    },
    required: ['theme']
  }
);
```

---

## Chapter 4: Resource Management

### 4.1 Static Resources

Simple static resource pattern:

```typescript
const STATIC_RESOURCES: Resource[] = [
  {
    uri: "resource://config/settings",
    name: "Application Settings",
    mimeType: "application/json",
    text: JSON.stringify(settings),
  },
  {
    uri: "resource://data/users",
    name: "User Database",
    mimeType: "application/json",
    text: JSON.stringify(users),
  },
];

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: STATIC_RESOURCES };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resource = STATIC_RESOURCES.find(r => r.uri === request.params.uri);
  if (!resource) throw new Error(`Resource not found: ${request.params.uri}`);
  return { contents: [resource] };
});
```

### 4.2 Dynamic Resources

Generate resources on demand:

```typescript
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  if (uri.startsWith("resource://dynamic/")) {
    const id = uri.split("/").pop();
    const data = await fetchDataFromDatabase(id);
    
    return {
      contents: [{
        uri,
        name: `Dynamic Resource ${id}`,
        mimeType: "application/json",
        text: JSON.stringify(data),
      }],
    };
  }
  
  throw new Error(`Unknown resource: ${uri}`);
});
```

### 4.3 Resource Templates

Enable parameterized resource access:

```typescript
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: "resource://user/{userId}/profile",
        name: "User Profile",
        description: "Access user profile by ID",
      },
      {
        uriTemplate: "resource://project/{projectId}/files/{path}",
        name: "Project Files",
        description: "Access project files by path",
      },
    ],
  };
});

// Handle templated resources in ReadResourceRequestSchema
const match = uri.match(/^resource:\/\/user\/(\d+)\/profile$/);
if (match) {
  const userId = match[1];
  const profile = await getUserProfile(userId);
  return {
    contents: [{
      uri,
      name: `User ${userId} Profile`,
      mimeType: "application/json",
      text: JSON.stringify(profile),
    }],
  };
}
```

### 4.4 Resource Subscriptions

Implement real-time resource updates:

```typescript
let subscriptions: Set<string> = new Set();
let updateInterval: NodeJS.Timeout | undefined;

server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  const { uri } = request.params;
  subscriptions.add(uri);
  
  // Start notifications if first subscription
  if (subscriptions.size === 1) {
    updateInterval = setInterval(async () => {
      for (const subscribedUri of subscriptions) {
        // Check if resource actually changed
        const hasChanged = await checkResourceChanged(subscribedUri);
        
        if (hasChanged) {
          server.notification({
            method: "notifications/resources/updated",
            params: { uri: subscribedUri },
          });
        }
      }
    }, 5000); // Check every 5 seconds
  }
  
  return {};
});

server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  subscriptions.delete(request.params.uri);
  
  // Stop notifications if no subscriptions
  if (subscriptions.size === 0 && updateInterval) {
    clearInterval(updateInterval);
    updateInterval = undefined;
  }
  
  return {};
});
```

### 4.5 Pagination Pattern

Handle large resource collections:

```typescript
const PAGE_SIZE = 20;

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  const cursor = request.params?.cursor;
  
  // Decode cursor to get offset
  let offset = 0;
  if (cursor) {
    try {
      offset = parseInt(atob(cursor), 10);
    } catch {
      throw new Error("Invalid cursor");
    }
  }
  
  // Fetch resources with limit
  const allResources = await fetchAllResources();
  const pageResources = allResources.slice(offset, offset + PAGE_SIZE);
  
  // Create next cursor if more resources exist
  let nextCursor: string | undefined;
  if (offset + PAGE_SIZE < allResources.length) {
    nextCursor = btoa((offset + PAGE_SIZE).toString());
  }
  
  return {
    resources: pageResources,
    nextCursor,
  };
});
```

---

## Chapter 5: Prompt Engineering

### 5.1 Simple Prompts

Basic prompt without arguments:

```typescript
{
  name: "analyze_code",
  description: "Analyze the current codebase",
}

// Handler
if (name === "analyze_code") {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Please analyze the codebase for potential improvements, focusing on performance, security, and maintainability.",
        },
      },
    ],
  };
}
```

### 5.2 Parameterized Prompts

Prompts with required and optional arguments:

```typescript
{
  name: "generate_code",
  description: "Generate code based on specifications",
  arguments: [
    {
      name: "language",
      description: "Programming language",
      required: true,
    },
    {
      name: "framework",
      description: "Framework to use",
      required: false,
    },
    {
      name: "style",
      description: "Coding style guide",
      required: false,
    },
  ],
}

// Handler
if (name === "generate_code") {
  const language = args?.language || "typescript";
  const framework = args?.framework || "none";
  const style = args?.style || "standard";
  
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate ${language} code ${framework !== 'none' ? `using ${framework}` : ''} following ${style} style guide.`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: "I'll help you generate the code. What specific functionality do you need?",
        },
      },
    ],
  };
}
```

### 5.3 Resource-Embedded Prompts

Include resources directly in prompts:

```typescript
if (name === "review_document") {
  const documentId = args?.documentId;
  const document = await fetchDocument(documentId);
  
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Please review the following document for accuracy and clarity:",
        },
      },
      {
        role: "user",
        content: {
          type: "resource",
          resource: {
            uri: `document://${documentId}`,
            name: document.title,
            mimeType: "text/markdown",
            text: document.content,
          },
        },
      },
    ],
  };
}
```

### 5.4 Multi-Modal Prompts

Combine text, images, and resources:

```typescript
return {
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: "Analyze this system architecture:",
      },
    },
    {
      role: "user",
      content: {
        type: "image",
        data: architectureDiagramBase64,
        mimeType: "image/png",
      },
    },
    {
      role: "user",
      content: {
        type: "resource",
        resource: {
          uri: "resource://architecture/spec",
          name: "Architecture Specification",
          mimeType: "application/json",
          text: JSON.stringify(architectureSpec),
        },
      },
    },
  ],
};
```

---

## Chapter 6: Transport Layer Implementation

### 6.1 stdio Transport (Default)

The simplest transport for local execution:

```typescript
// stdio.ts
#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const transport = new StdioServerTransport();
  const { server, cleanup } = createServer();
  
  await server.connect(transport);
  
  // Graceful shutdown
  process.on("SIGINT", async () => {
    await cleanup();
    await server.close();
    process.exit(0);
  });
  
  process.on("SIGTERM", async () => {
    await cleanup();
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

### 6.2 SSE Transport (Server-Sent Events)

For browser-based clients:

```typescript
// sse.ts
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./server.js";

const app = express();
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  const { server, cleanup, startNotificationIntervals } = createServer();
  const transport = new SSEServerTransport("/message", res);
  
  transports.set(transport.sessionId, transport);
  await server.connect(transport);
  
  // Start background processes
  startNotificationIntervals();
  
  // Cleanup on disconnect
  server.onclose = async () => {
    transports.delete(transport.sessionId);
    await cleanup();
  };
});

app.post("/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SSE server running on port ${PORT}`);
});
```

### 6.3 Streamable HTTP Transport

Modern HTTP-based transport with resumability:

```typescript
// streamableHttp.ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import express from "express";
import { createServer } from "./server.js";
import { randomUUID } from 'node:crypto';

const app = express();
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string;
    let transport: StreamableHTTPServerTransport;
    
    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId)!;
    } else if (!sessionId) {
      // New session initialization
      const { server, cleanup } = createServer();
      const eventStore = new InMemoryEventStore();
      
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore, // Enable resumability
        onsessioninitialized: (sid: string) => {
          transports.set(sid, transport);
        }
      });
      
      // Setup cleanup
      server.onclose = async () => {
        const sid = transport.sessionId;
        if (sid && transports.has(sid)) {
          transports.delete(sid);
          await cleanup();
        }
      };
      
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Invalid session',
        },
      });
      return;
    }
    
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
      },
    });
  }
});

// Handle SSE streams
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  const lastEventId = req.headers['last-event-id'] as string;
  
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: 'Invalid session' });
    return;
  }
  
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// Handle session termination
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: 'Invalid session' });
    return;
  }
  
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Streamable HTTP server on port ${PORT}`);
});
```

---

## Chapter 7: Advanced Features

### 7.1 Roots Protocol

Enable filesystem access control:

```typescript
let currentRoots: Root[] = [];
let clientSupportsRoots = false;

// Check capabilities on initialization
server.oninitialized = async () => {
  const capabilities = server.getClientCapabilities();
  
  if (capabilities?.roots) {
    clientSupportsRoots = true;
    try {
      const response = await server.listRoots();
      if (response && 'roots' in response) {
        currentRoots = response.roots;
        console.log(`Received ${currentRoots.length} roots`);
      }
    } catch (error) {
      console.error("Failed to get roots:", error);
    }
  }
};

// Handle roots changes
server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
  if (!clientSupportsRoots) return;
  
  try {
    const response = await server.listRoots();
    if (response && 'roots' in response) {
      currentRoots = response.roots;
      
      // Notify about the change
      await server.notification({
        method: "notifications/message",
        params: {
          level: "info",
          data: `Roots updated: ${currentRoots.length} root(s)`,
        },
      });
    }
  } catch (error) {
    console.error("Failed to update roots:", error);
  }
});

// Tool to list current roots
if (name === "listRoots") {
  if (!clientSupportsRoots) {
    return {
      content: [{
        type: "text",
        text: "Client does not support roots protocol",
      }],
    };
  }
  
  const rootsList = currentRoots.map((root, i) => 
    `${i + 1}. ${root.name || 'Unnamed'}: ${root.uri}`
  ).join('\n');
  
  return {
    content: [{
      type: "text",
      text: `Current roots:\n${rootsList}`,
    }],
  };
}
```

### 7.2 Completion Support

Provide intelligent argument completion:

```typescript
server.setRequestHandler(CompleteRequestSchema, async (request) => {
  const { ref, argument } = request.params;
  
  // Resource completion
  if (ref.type === "ref/resource") {
    const resourceId = ref.uri.split("/").pop();
    const allIds = ["1", "2", "3", "4", "5"];
    const matches = allIds.filter(id => 
      id.startsWith(argument.value)
    );
    
    return {
      completion: {
        values: matches,
        hasMore: false,
        total: matches.length,
      },
    };
  }
  
  // Prompt argument completion
  if (ref.type === "ref/prompt") {
    const completions: Record<string, string[]> = {
      language: ["typescript", "javascript", "python", "rust"],
      style: ["casual", "formal", "technical"],
      framework: ["react", "vue", "angular", "svelte"],
    };
    
    const values = completions[argument.name] || [];
    const matches = values.filter(v => 
      v.toLowerCase().startsWith(argument.value.toLowerCase())
    );
    
    return {
      completion: {
        values: matches,
        hasMore: false,
        total: matches.length,
      },
    };
  }
  
  return { completion: { values: [] } };
});
```

### 7.3 Logging System

Implement structured logging:

```typescript
let logLevel: LoggingLevel = "info";

const logLevels: LoggingLevel[] = [
  "debug", "info", "notice", "warning", 
  "error", "critical", "alert", "emergency"
];

const logLevelPriority = new Map(
  logLevels.map((level, index) => [level, index])
);

const shouldLog = (level: LoggingLevel): boolean => {
  const messagePriority = logLevelPriority.get(level) || 0;
  const currentPriority = logLevelPriority.get(logLevel) || 0;
  return messagePriority >= currentPriority;
};

const log = async (level: LoggingLevel, message: string, data?: any) => {
  if (!shouldLog(level)) return;
  
  await server.notification({
    method: "notifications/message",
    params: {
      level,
      logger: "mcp-server",
      data: message,
      ...(data && { metadata: data }),
    },
  });
};

// Set log level handler
server.setRequestHandler(SetLevelRequestSchema, async (request) => {
  const oldLevel = logLevel;
  logLevel = request.params.level;
  
  await log("info", `Log level changed from ${oldLevel} to ${logLevel}`);
  return {};
});

// Usage throughout server
await log("debug", "Processing request", { requestId: "123" });
await log("error", "Operation failed", { error: error.message });
await log("info", "Server started successfully");
```

### 7.4 Resource Links

Return references to resources:

```typescript
return {
  content: [
    {
      type: "text",
      text: "Here are related resources:",
    },
    {
      type: "resource_link",
      uri: "resource://doc/guide",
      name: "User Guide",
      description: "Complete user documentation",
      mimeType: "text/markdown",
    },
    {
      type: "resource_link",
      uri: "resource://config/settings",
      name: "Settings",
      description: "Current configuration",
      mimeType: "application/json",
    },
  ],
};
```

---

## Chapter 8: Production Considerations

### 8.1 Error Handling

Comprehensive error handling strategy:

```typescript
class MCPError extends Error {
  code: number;
  data?: any;
  
  constructor(code: number, message: string, data?: any) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

// Standard error codes
const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // Custom codes
  RESOURCE_NOT_FOUND: -32001,
  PERMISSION_DENIED: -32002,
  RATE_LIMITED: -32003,
} as const;

// Wrap handlers with error handling
const safeHandler = <T extends (...args: any[]) => Promise<any>>(
  handler: T
): T => {
  return (async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      
      if (error instanceof z.ZodError) {
        throw new MCPError(
          ErrorCodes.INVALID_PARAMS,
          "Invalid parameters",
          error.errors
        );
      }
      
      console.error("Unhandled error:", error);
      throw new MCPError(
        ErrorCodes.INTERNAL_ERROR,
        "Internal server error"
      );
    }
  }) as T;
};

// Use in handlers
server.setRequestHandler(CallToolRequestSchema, safeHandler(async (request) => {
  // Handler implementation
}));
```

### 8.2 Rate Limiting

Implement rate limiting for tools:

```typescript
class RateLimiter {
  private requests = new Map<string, number[]>();
  private maxRequests: number;
  private windowMs: number;
  
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  check(clientId: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(clientId) || [];
    
    // Remove old requests
    const validRequests = requests.filter(
      time => now - time < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(clientId, validRequests);
    return true;
  }
}

const rateLimiter = new RateLimiter();

// In tool handler
if (!rateLimiter.check(clientId)) {
  throw new MCPError(
    ErrorCodes.RATE_LIMITED,
    "Rate limit exceeded"
  );
}
```

### 8.3 Caching

Implement intelligent caching:

```typescript
class Cache<T> {
  private cache = new Map<string, { data: T; expiry: number }>();
  private ttl: number;
  
  constructor(ttlSeconds = 300) {
    this.ttl = ttlSeconds * 1000;
  }
  
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl,
    });
  }
  
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

const resourceCache = new Cache<Resource>();

// In resource handler
const cached = resourceCache.get(uri);
if (cached) {
  return { contents: [cached] };
}

const resource = await fetchResource(uri);
resourceCache.set(uri, resource);
return { contents: [resource] };
```

### 8.4 Health Monitoring

Implement health checks:

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    name: string;
    status: 'up' | 'down';
    latency?: number;
    error?: string;
  }[];
}

class HealthMonitor {
  private startTime = Date.now();
  private checks: Map<string, () => Promise<boolean>> = new Map();
  
  registerCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }
  
  async getStatus(): Promise<HealthStatus> {
    const results = await Promise.all(
      Array.from(this.checks.entries()).map(async ([name, check]) => {
        const start = Date.now();
        try {
          const success = await check();
          return {
            name,
            status: success ? 'up' : 'down' as const,
            latency: Date.now() - start,
          };
        } catch (error) {
          return {
            name,
            status: 'down' as const,
            latency: Date.now() - start,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );
    
    const hasFailures = results.some(r => r.status === 'down');
    
    return {
      status: hasFailures ? 'unhealthy' : 'healthy',
      version: "1.0.0",
      uptime: Date.now() - this.startTime,
      checks: results,
    };
  }
}

const healthMonitor = new HealthMonitor();

// Register health checks
healthMonitor.registerCheck('database', async () => {
  return await checkDatabaseConnection();
});

healthMonitor.registerCheck('external_api', async () => {
  return await pingExternalAPI();
});

// Health check tool
if (name === "healthCheck") {
  const status = await healthMonitor.getStatus();
  return {
    content: [{
      type: "text",
      text: JSON.stringify(status, null, 2),
    }],
  };
}
```

### 8.5 Metrics Collection

Track server metrics:

```typescript
class MetricsCollector {
  private metrics = {
    requests: new Map<string, number>(),
    errors: new Map<string, number>(),
    latencies: [] as number[],
    activeConnections: 0,
  };
  
  trackRequest(method: string, latency: number, error?: boolean): void {
    // Track request count
    const count = this.metrics.requests.get(method) || 0;
    this.metrics.requests.set(method, count + 1);
    
    // Track errors
    if (error) {
      const errorCount = this.metrics.errors.get(method) || 0;
      this.metrics.errors.set(method, errorCount + 1);
    }
    
    // Track latency (keep last 1000)
    this.metrics.latencies.push(latency);
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies.shift();
    }
  }
  
  connectionOpened(): void {
    this.metrics.activeConnections++;
  }
  
  connectionClosed(): void {
    this.metrics.activeConnections--;
  }
  
  getMetrics(): any {
    const avgLatency = this.metrics.latencies.length > 0
      ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length
      : 0;
    
    return {
      requests: Object.fromEntries(this.metrics.requests),
      errors: Object.fromEntries(this.metrics.errors),
      avgLatency,
      activeConnections: this.metrics.activeConnections,
    };
  }
}

const metrics = new MetricsCollector();

// Wrap handlers to collect metrics
const withMetrics = <T extends (...args: any[]) => Promise<any>>(
  method: string,
  handler: T
): T => {
  return (async (...args) => {
    const start = Date.now();
    try {
      const result = await handler(...args);
      metrics.trackRequest(method, Date.now() - start);
      return result;
    } catch (error) {
      metrics.trackRequest(method, Date.now() - start, true);
      throw error;
    }
  }) as T;
};
```

---

## Chapter 9: Testing and Debugging

### 9.1 Unit Testing Tools

Test individual tools in isolation:

```typescript
// __tests__/tools.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createServer } from '../server.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

describe('Tools', () => {
  let server: any;
  let handler: any;
  
  beforeEach(() => {
    const result = createServer();
    server = result.server;
    
    // Get the call tool handler
    handler = server.requestHandlers.get(CallToolRequestSchema.method);
  });
  
  describe('echo tool', () => {
    it('should echo the message', async () => {
      const request = {
        params: {
          name: 'echo',
          arguments: { message: 'Hello, World!' }
        }
      };
      
      const response = await handler(request);
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toBe('Echo: Hello, World!');
    });
    
    it('should validate input', async () => {
      const request = {
        params: {
          name: 'echo',
          arguments: { invalid: 'field' }
        }
      };
      
      await expect(handler(request)).rejects.toThrow();
    });
  });
  
  describe('add tool', () => {
    it('should add two numbers', async () => {
      const request = {
        params: {
          name: 'add',
          arguments: { a: 5, b: 3 }
        }
      };
      
      const response = await handler(request);
      expect(response.content[0].text).toContain('8');
    });
  });
});
```

### 9.2 Integration Testing

Test complete server flows:

```typescript
// __tests__/integration.test.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createServer } from '../server.js';

describe('Server Integration', () => {
  let server: any;
  let client: Client;
  let cleanup: () => Promise<void>;
  
  beforeEach(async () => {
    const result = createServer();
    server = result.server;
    cleanup = result.cleanup;
    
    // Create mock transport
    const serverTransport = new MockTransport();
    const clientTransport = new MockTransport();
    
    // Connect transports
    serverTransport.peer = clientTransport;
    clientTransport.peer = serverTransport;
    
    // Connect server and client
    await server.connect(serverTransport);
    client = new Client();
    await client.connect(clientTransport);
  });
  
  afterEach(async () => {
    await cleanup();
    await server.close();
    await client.close();
  });
  
  it('should list available tools', async () => {
    const tools = await client.listTools();
    
    expect(tools).toContainEqual(
      expect.objectContaining({ name: 'echo' })
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: 'add' })
    );
  });
  
  it('should execute tool and return result', async () => {
    const result = await client.callTool('echo', {
      message: 'Test message'
    });
    
    expect(result.content[0].text).toBe('Echo: Test message');
  });
  
  it('should handle resource subscriptions', async () => {
    const resources = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
    
    const uri = resources[0].uri;
    await client.subscribe(uri);
    
    // Wait for notification
    const notifications: any[] = [];
    client.on('notification', (n) => notifications.push(n));
    
    await new Promise(resolve => setTimeout(resolve, 11000));
    
    expect(notifications).toContainEqual(
      expect.objectContaining({
        method: 'notifications/resources/updated',
        params: { uri }
      })
    );
  });
});
```

### 9.3 Debugging Tools

Build debugging capabilities into the server:

```typescript
// Debug tool for introspection
if (name === "debug") {
  const debugInfo = {
    server: {
      name: server.name,
      version: server.version,
      uptime: Date.now() - startTime,
    },
    state: {
      subscriptions: Array.from(subscriptions),
      activeConnections: transports.size,
      logLevel,
      roots: currentRoots,
    },
    capabilities: clientCapabilities,
    metrics: metrics.getMetrics(),
    environment: {
      node: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
    },
  };
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify(debugInfo, null, 2),
    }],
  };
}

// Trace tool for request logging
if (name === "trace") {
  const { enable } = TraceSchema.parse(args);
  
  if (enable) {
    server.on('request', (req) => {
      console.log('[TRACE] Request:', JSON.stringify(req));
    });
    server.on('response', (res) => {
      console.log('[TRACE] Response:', JSON.stringify(res));
    });
  }
  
  return {
    content: [{
      type: "text",
      text: `Tracing ${enable ? 'enabled' : 'disabled'}`,
    }],
  };
}
```

### 9.4 Test Client

Build a test client for manual testing:

```typescript
// test-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

async function testServer() {
  const serverProcess = spawn('node', ['dist/stdio.js']);
  const transport = new StdioClientTransport({
    stdin: serverProcess.stdin,
    stdout: serverProcess.stdout,
    stderr: serverProcess.stderr,
  });
  
  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  });
  
  await client.connect(transport);
  
  // Test tool listing
  console.log('Available tools:');
  const tools = await client.listTools();
  tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });
  
  // Test tool execution
  console.log('\nTesting echo tool:');
  const echoResult = await client.callTool('echo', {
    message: 'Hello from test client!',
  });
  console.log('  Result:', echoResult.content[0].text);
  
  // Test resources
  console.log('\nAvailable resources:');
  const resources = await client.listResources();
  resources.slice(0, 5).forEach(resource => {
    console.log(`  - ${resource.uri}: ${resource.name}`);
  });
  
  // Test prompts
  console.log('\nAvailable prompts:');
  const prompts = await client.listPrompts();
  prompts.forEach(prompt => {
    console.log(`  - ${prompt.name}: ${prompt.description}`);
  });
  
  await client.close();
  serverProcess.kill();
}

testServer().catch(console.error);
```

---

## Chapter 10: Real-World Patterns

### 10.1 Database Integration Pattern

Connect MCP server to databases:

```typescript
import { Pool } from 'pg';

class DatabaseServer {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  
  async initialize() {
    // Test connection
    await this.pool.query('SELECT 1');
    
    // Register tools
    this.registerQueryTool();
    this.registerSchemaTools();
    this.registerDataTools();
  }
  
  private registerQueryTool() {
    const QuerySchema = z.object({
      query: z.string().describe("SQL query to execute"),
      params: z.array(z.any()).optional().describe("Query parameters"),
    });
    
    // In tool handler
    if (name === "executeQuery") {
      const { query, params } = QuerySchema.parse(args);
      
      // Validate query (prevent destructive operations)
      if (!/^SELECT/i.test(query.trim())) {
        throw new Error("Only SELECT queries allowed");
      }
      
      const result = await this.pool.query(query, params);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            rows: result.rows,
            rowCount: result.rowCount,
            fields: result.fields.map(f => f.name),
          }, null, 2),
        }],
      };
    }
  }
  
  private registerSchemaTools() {
    // Tool to list tables
    if (name === "listTables") {
      const result = await this.pool.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `);
      
      return {
        content: [{
          type: "text",
          text: result.rows.map(r => r.tablename).join('\n'),
        }],
      };
    }
    
    // Tool to describe table
    if (name === "describeTable") {
      const { tableName } = DescribeTableSchema.parse(args);
      
      const result = await this.pool.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result.rows, null, 2),
        }],
      };
    }
  }
}
```

### 10.2 File System Server Pattern

Implement secure file system access:

```typescript
import { promises as fs } from 'fs';
import path from 'path';

class FileSystemServer {
  private allowedPaths: string[] = [];
  
  constructor() {
    // Set allowed paths from environment or config
    this.allowedPaths = (process.env.ALLOWED_PATHS || '')
      .split(',')
      .map(p => path.resolve(p));
  }
  
  private isPathAllowed(requestedPath: string): boolean {
    const resolved = path.resolve(requestedPath);
    return this.allowedPaths.some(allowed => 
      resolved.startsWith(allowed)
    );
  }
  
  async registerTools() {
    // List files tool
    if (name === "listFiles") {
      const { directory } = ListFilesSchema.parse(args);
      
      if (!this.isPathAllowed(directory)) {
        throw new Error("Access denied to directory");
      }
      
      const files = await fs.readdir(directory, { withFileTypes: true });
      const items = files.map(f => ({
        name: f.name,
        type: f.isDirectory() ? 'directory' : 'file',
        path: path.join(directory, f.name),
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(items, null, 2),
        }],
      };
    }
    
    // Read file tool
    if (name === "readFile") {
      const { filePath } = ReadFileSchema.parse(args);
      
      if (!this.isPathAllowed(filePath)) {
        throw new Error("Access denied to file");
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        content: [{
          type: "text",
          text: content,
        }],
      };
    }
    
    // Write file tool (with safety checks)
    if (name === "writeFile") {
      const { filePath, content } = WriteFileSchema.parse(args);
      
      if (!this.isPathAllowed(filePath)) {
        throw new Error("Access denied to file");
      }
      
      // Create backup
      const backupPath = `${filePath}.backup`;
      try {
        await fs.copyFile(filePath, backupPath);
      } catch {
        // File doesn't exist yet
      }
      
      await fs.writeFile(filePath, content, 'utf-8');
      
      return {
        content: [{
          type: "text",
          text: `File written successfully: ${filePath}`,
        }],
      };
    }
  }
  
  async registerResources() {
    // Expose files as resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources: Resource[] = [];
      
      for (const allowedPath of this.allowedPaths) {
        const files = await this.walkDirectory(allowedPath);
        
        for (const file of files) {
          resources.push({
            uri: `file://${file}`,
            name: path.basename(file),
            mimeType: this.getMimeType(file),
          });
        }
      }
      
      return { resources };
    });
    
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (!uri.startsWith('file://')) {
        throw new Error("Invalid file URI");
      }
      
      const filePath = uri.slice(7);
      
      if (!this.isPathAllowed(filePath)) {
        throw new Error("Access denied");
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        contents: [{
          uri,
          name: path.basename(filePath),
          mimeType: this.getMimeType(filePath),
          text: content,
        }],
      };
    });
  }
  
  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.walkDirectory(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }
  
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
```

### 10.3 API Gateway Pattern

Bridge external APIs through MCP:

```typescript
import axios from 'axios';

class APIGatewayServer {
  private apis = new Map<string, APIConfig>();
  
  interface APIConfig {
    baseURL: string;
    headers?: Record<string, string>;
    auth?: {
      type: 'bearer' | 'apikey' | 'basic';
      credentials: string;
    };
  }
  
  constructor() {
    // Configure APIs
    this.apis.set('github', {
      baseURL: 'https://api.github.com',
      auth: {
        type: 'bearer',
        credentials: process.env.GITHUB_TOKEN!,
      },
    });
    
    this.apis.set('weather', {
      baseURL: 'https://api.openweathermap.org/data/2.5',
      auth: {
        type: 'apikey',
        credentials: process.env.WEATHER_API_KEY!,
      },
    });
  }
  
  async registerTools() {
    // Generic API call tool
    const APICallSchema = z.object({
      api: z.string().describe("API name"),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
      endpoint: z.string().describe("API endpoint"),
      params: z.record(z.any()).optional(),
      data: z.any().optional(),
    });
    
    if (name === "apiCall") {
      const { api, method, endpoint, params, data } = APICallSchema.parse(args);
      
      const config = this.apis.get(api);
      if (!config) {
        throw new Error(`Unknown API: ${api}`);
      }
      
      const headers = { ...config.headers };
      
      // Add authentication
      if (config.auth) {
        switch (config.auth.type) {
          case 'bearer':
            headers['Authorization'] = `Bearer ${config.auth.credentials}`;
            break;
          case 'apikey':
            params['api_key'] = config.auth.credentials;
            break;
          case 'basic':
            headers['Authorization'] = `Basic ${config.auth.credentials}`;
            break;
        }
      }
      
      const response = await axios({
        method,
        url: `${config.baseURL}${endpoint}`,
        params,
        data,
        headers,
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.data, null, 2),
        }],
      };
    }
    
    // Specific API tools
    if (name === "searchGitHub") {
      const { query, type } = SearchGitHubSchema.parse(args);
      
      const response = await this.callAPI('github', 'GET', '/search/repositories', {
        q: query,
        type,
        sort: 'stars',
        order: 'desc',
      });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.items.slice(0, 10), null, 2),
        }],
      };
    }
  }
  
  private async callAPI(
    api: string,
    method: string,
    endpoint: string,
    params?: any,
    data?: any
  ) {
    // Implementation similar to apiCall tool
  }
}
```

### 10.4 Workflow Orchestration Pattern

Build complex workflows:

```typescript
class WorkflowServer {
  private workflows = new Map<string, Workflow>();
  
  interface Workflow {
    name: string;
    description: string;
    steps: WorkflowStep[];
  }
  
  interface WorkflowStep {
    id: string;
    type: 'tool' | 'prompt' | 'condition' | 'parallel';
    config: any;
    next?: string | string[];
  }
  
  async registerWorkflows() {
    // Define workflows
    this.workflows.set('deploy', {
      name: 'Deploy Application',
      description: 'Full deployment workflow',
      steps: [
        {
          id: 'test',
          type: 'tool',
          config: { tool: 'runTests' },
          next: 'build',
        },
        {
          id: 'build',
          type: 'tool',
          config: { tool: 'buildApp' },
          next: 'deploy-check',
        },
        {
          id: 'deploy-check',
          type: 'condition',
          config: {
            condition: 'buildSuccess',
            true: 'deploy',
            false: 'notify-failure',
          },
        },
        {
          id: 'deploy',
          type: 'parallel',
          config: {
            steps: ['deploy-staging', 'deploy-production'],
          },
          next: 'notify-success',
        },
      ],
    });
  }
  
  async executeWorkflow(workflowName: string, context: any) {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Unknown workflow: ${workflowName}`);
    }
    
    const execution = new WorkflowExecution(workflow, context);
    return await execution.run();
  }
}

class WorkflowExecution {
  private workflow: Workflow;
  private context: Map<string, any>;
  private results: Map<string, any>;
  
  constructor(workflow: Workflow, initialContext: any) {
    this.workflow = workflow;
    this.context = new Map(Object.entries(initialContext));
    this.results = new Map();
  }
  
  async run() {
    let currentStep = this.workflow.steps[0];
    
    while (currentStep) {
      const result = await this.executeStep(currentStep);
      this.results.set(currentStep.id, result);
      
      // Determine next step
      if (currentStep.next) {
        if (typeof currentStep.next === 'string') {
          currentStep = this.workflow.steps.find(s => s.id === currentStep.next);
        } else {
          // Handle multiple next steps (parallel)
          const nextSteps = currentStep.next.map(id => 
            this.workflow.steps.find(s => s.id === id)
          );
          
          // Execute in parallel
          const results = await Promise.all(
            nextSteps.map(step => this.executeStep(step!))
          );
          
          // Store results and continue
          nextSteps.forEach((step, i) => {
            this.results.set(step!.id, results[i]);
          });
          
          break; // End of workflow
        }
      } else {
        break; // End of workflow
      }
    }
    
    return {
      success: true,
      results: Object.fromEntries(this.results),
    };
  }
  
  private async executeStep(step: WorkflowStep) {
    switch (step.type) {
      case 'tool':
        return await this.executeTool(step.config.tool, step.config.args);
      
      case 'prompt':
        return await this.executePrompt(step.config.prompt, step.config.args);
      
      case 'condition':
        return await this.evaluateCondition(step.config.condition);
      
      case 'parallel':
        return await Promise.all(
          step.config.steps.map((s: string) => this.executeStep(
            this.workflow.steps.find(step => step.id === s)!
          ))
        );
      
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }
}
```

---

## Conclusion: Building Production-Ready MCP Servers

This practical guide has demonstrated how to build robust, feature-complete MCP servers by examining the comprehensive "everything" server implementation. Key takeaways:

### Architecture Best Practices
1. **Use factory functions** for server creation to enable testing and multiple instances
2. **Implement proper cleanup** for all resources, timers, and connections
3. **Leverage TypeScript** for type safety with Zod schema validation
4. **Support multiple transports** to maximize compatibility

### Implementation Patterns
1. **Tools**: Validate inputs, handle errors gracefully, support progress notifications
2. **Resources**: Implement pagination, caching, and subscriptions for scalability
3. **Prompts**: Design reusable, parameterized templates for common workflows
4. **Client Interactions**: Use sampling and elicitation for dynamic interactions

### Production Considerations
1. **Error Handling**: Comprehensive error handling with proper error codes
2. **Rate Limiting**: Protect server resources from abuse
3. **Monitoring**: Implement health checks and metrics collection
4. **Security**: Validate all inputs, implement access controls, audit logging

### Testing Strategy
1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Verify complete workflows
3. **Debug Tools**: Build introspection capabilities into the server

The MCP protocol provides a powerful foundation for building AI-integrated applications. By following these patterns and best practices derived from real implementation, you can create production-ready servers that seamlessly connect LLMs to your domain-specific capabilities.

Remember: Start simple with basic tools and resources, then progressively add advanced features like subscriptions, progress notifications, and client interactions as your requirements grow. The modular nature of MCP allows incremental development while maintaining compatibility.