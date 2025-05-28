import { JRPCHost } from "../jrpc/host";
import { JRPC_Response, ValidationPipe } from "../jrpc/types";
import { validateJsonSchema } from "../utils/jsonSchema";
import {
  McpServerOpts,
  ResourceData,
  ResourceDefinition,
  ToolData,
  ToolDefinition,
} from "./decorators";

export abstract class McpStream {
  private readonly host: JRPCHost;

  constructor(
    protected readonly _opts: McpServerOpts,
    protected readonly tools: Map<string, ToolDefinition>,
    protected readonly resources: Map<string, ResourceDefinition>
  ) {
    this.host = new JRPCHost();
  }

  public abstract listen(): Promise<void>;

  protected abstract send(data: object): Promise<void>;

  public sendMessage(message: object): Promise<void> {
    return this.send(this.host.buildMessage(message));
  }

  public handleMessage(message: object): Promise<JRPC_Response | undefined> {
    return this.host.handleMessage(message);
  }

  public handleMessages(
    messages: object[]
  ): Promise<JRPC_Response[] | JRPC_Response | undefined> {
    return this.host.handleMessages(messages);
  }

  public registerMethod(
    name: string,
    handler: (params: any) => Promise<any>,
    pipes?: ValidationPipe[]
  ) {
    this.host.registerMethod(name, handler, pipes);
  }

  public async callTool(name: string, params: any) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    const parse = validateJsonSchema(tool.inputSchema, params);
    if (!parse.success) {
      throw new Error(`Invalid params: ${JSON.stringify(parse.error)}`);
    }

    const response = await tool.handler(parse.data);
    return {
      content: [
        {
          type: "text",
          text: response,
        },
      ],
      isError: false,
    };
  }

  public callResource(name: string, params: any) {
    const resource = this.resources.get(name);
    if (!resource) {
      throw new Error(`Resource ${name} not found`);
    }
    return resource.handler(params);
  }

  public getToolsList(): ToolData[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  public getResourcesList(): ResourceData[] {
    return Array.from(this.resources.values()).map((resource) => ({
      name: resource.name,
      description: resource.description,
      uri: resource.uri,
      mimeType: resource.mimeType,
    }));
  }
}
