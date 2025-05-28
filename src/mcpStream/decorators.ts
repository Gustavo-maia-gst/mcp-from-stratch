import "reflect-metadata";
import Ajv from "ajv";
import { McpStreamFactory } from "./mcpStreamFactory";
import { Class, forEachMethod } from "../utils/reflect";

const MCP_SERVER_KEY = Symbol("__mcp:server");
const MCP_TYPE_KEY = Symbol("__mcp:type");
const MCP_RESOURCE_KEY = Symbol("__mcp:resource");
const MCP_TOOL_KEY = Symbol("__mcp:tool");

export enum McpStreamType {
  STDIO = "stdio",
  HTTP = "http",
}

export enum McpMethodType {
  TOOL = "tool",
  RESOURCE = "resource",
}

export type McpServerOpts =
  | {
      type: McpStreamType.HTTP;
      serverName?: string;
      instructions?: string;
      version?: string;
      port?: number;
      path?: string;
    }
  | {
      type: McpStreamType.STDIO;
      serverName?: string;
      instructions?: string;
      version?: string;
    };

export function McpServer(opts: McpServerOpts) {
  return (target: any) => {
    Reflect.defineMetadata(MCP_SERVER_KEY, opts, target);
  };
}

export type ToolData = {
  name: string;
  description: string;
  inputSchema: object;
};
export type ResourceData = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
};

export type ToolDefinition = ToolData & {
  handler: (params: any) => Promise<any>;
};
export type ResourceDefinition = ResourceData & {
  handler: (params: any) => Promise<any>;
};

export function Resource(definition: ResourceData) {
  return (target: any, propertyKey: string | symbol) => {
    Reflect.defineMetadata(
      MCP_TYPE_KEY,
      McpMethodType.RESOURCE,
      target,
      propertyKey
    );
    Reflect.defineMetadata(MCP_RESOURCE_KEY, definition, target, propertyKey);
  };
}

export function Tool(definition: ToolData) {
  const ajv = new Ajv();
  const isValidSchema = ajv.validateSchema(definition.inputSchema);
  if (!isValidSchema) {
    throw new Error(`Invalid schema: ${JSON.stringify(ajv.errors)}`);
  }

  return (target: any, propertyKey: string | symbol) => {
    Reflect.defineMetadata(
      MCP_TYPE_KEY,
      McpMethodType.TOOL,
      target,
      propertyKey
    );
    Reflect.defineMetadata(MCP_TOOL_KEY, definition, target, propertyKey);
  };
}

export function StartServer(server: Class) {
  console.log("Starting MCP server...");
  const opts: McpServerOpts = Reflect.getMetadata(MCP_SERVER_KEY, server);
  if (!opts) {
    throw new Error("Invalid server, class must be decorated with @McpServer");
  }
  console.log("Server options:", opts);

  const factory = new McpStreamFactory(opts);

  forEachMethod(server, (proto, method) => {
    const methodImpl = proto[method];
    const type: McpMethodType = Reflect.getMetadata(
      MCP_TYPE_KEY,
      proto,
      method
    );

    if (!methodImpl || typeof methodImpl !== "function" || !type) return;

    if (type === McpMethodType.TOOL) {
      const definition: ToolData = Reflect.getMetadata(
        MCP_TOOL_KEY,
        proto,
        method
      );
      if (!definition) {
        throw new Error(`Tool ${method} is not decorated with @Tool`);
      }

      console.log("Registering tool:", definition.name);

      factory.registerTool(definition, methodImpl);
    } else {
      const definition: ResourceData = Reflect.getMetadata(
        MCP_RESOURCE_KEY,
        proto,
        method
      );
      if (!definition) {
        throw new Error(`Resource ${method} is not decorated with @Resource`);
      }

      console.log("Registering resource:", definition.name);

      factory.registerResource(definition, methodImpl);
    }
  });

  const stream = factory.build();

  console.log("Starting server instance...");
  stream.listen();
}
