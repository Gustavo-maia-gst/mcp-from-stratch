import { McpServer, McpStreamType, Tool } from "../mcpStream/decorators";

@McpServer({ type: McpStreamType.HTTP, port: 3000 })
export class Teste {
  @Tool({
    name: "hello",
    description: "Say hello world and your name",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the person to say hello to",
        },
      },
    },
  })
  public async hello(params: { name: string }) {
    return `Hello ${params.name}`;
  }
}
