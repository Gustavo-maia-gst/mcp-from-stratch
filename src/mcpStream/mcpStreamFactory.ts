import {
  McpServerOpts,
  McpStreamType,
  ResourceData,
  ResourceDefinition,
  ToolData,
  ToolDefinition,
} from "./decorators";
import { McpHttpStream } from "./mcpHttpStream";
import { McpStream } from "./mcpStream";

export class McpStreamFactory {
  private readonly factory: Record<
    McpStreamType,
    (
      opts: McpServerOpts,
      tools: Map<string, ToolDefinition>,
      resources: Map<string, ResourceDefinition>
    ) => McpStream
  > = {
    [McpStreamType.HTTP]: (
      opts: McpServerOpts,
      tools: Map<string, ToolDefinition>,
      resources: Map<string, ResourceDefinition>
    ) => new McpHttpStream(opts, tools, resources),

    [McpStreamType.STDIO]: () => {
      throw new Error("STDIO is not supported");
    },
  };

  private resources: Map<string, ResourceDefinition> = new Map();
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(private readonly opts: McpServerOpts) {}

  public registerResource(
    data: ResourceData,
    implementation: (params: any) => Promise<any>
  ) {
    if (this.resources.has(data.name)) {
      throw new Error(`Resource ${data.name} is duplicated`);
    }

    this.resources.set(data.name, { ...data, handler: implementation });
  }

  public registerTool(
    data: ToolData,
    implementation: (params: any) => Promise<any>
  ) {
    if (this.tools.has(data.name)) {
      throw new Error(`Tool ${data.name} is duplicated`);
    }

    this.tools.set(data.name, { ...data, handler: implementation });
  }

  public build(): McpStream {
    const stream = this.factory[this.opts.type](
      this.opts,
      this.tools,
      this.resources
    );

    this.registerProtocolMethods(stream);

    return stream;
  }

  private registerProtocolMethods(stream: McpStream) {
    stream.registerMethod("initialize", (_params: any) => {
      return Promise.resolve({
        protocolVersion: "2024-11-05",
        capabilities: {
          logging: {},
          prompts: {},
          resources: {
            listChanged: false,
          },
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: this.opts.serverName ?? "GustavoMCP",
          version: this.opts.version ?? "0.0.1",
        },
        instructions: this.opts.instructions ?? "MCP Server",
      });
    });

    stream.registerMethod("notifications/initialized", (_params: any) => {
      return Promise.resolve();
    });

    stream.registerMethod("tools/list", (_params: any) => {
      return Promise.resolve({ tools: stream.getToolsList() });
    });

    stream.registerMethod("resources/list", (_params: any) => {
      return Promise.resolve({ resources: stream.getResourcesList() });
    });

    stream.registerMethod("tools/call", (params: any) => {
      return stream.callTool(params.name, params.arguments);
    });

    stream.registerMethod("resources/read", (params: any) => {
      return stream.callResource(params.name, params.arguments);
    });

    stream.registerMethod("ping", (_params: any) => {
      return Promise.resolve({});
    });
  }
}
