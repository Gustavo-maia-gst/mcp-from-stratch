import { JRPC_ErrorCodes } from "../jrpc/error";
import { isErrorResponse } from "../jrpc/types";
import {
  McpServerOpts,
  McpStreamType,
  ResourceDefinition,
  ToolDefinition,
} from "./decorators";
import { McpStream } from "./mcpStream";
import express from "express";
import { v4 as uuid } from "uuid";

const DEFAULT_PORT = 3000;

const JRPC_ERROR_STATUS_CODES: Record<number, number> = {
  [JRPC_ErrorCodes.PARSE_ERROR]: 400,
  [JRPC_ErrorCodes.INVALID_REQUEST]: 400,
  [JRPC_ErrorCodes.METHOD_NOT_FOUND]: 404,
  [JRPC_ErrorCodes.INVALID_PARAMS]: 400,
  [JRPC_ErrorCodes.INTERNAL_ERROR]: 500,
};

export class McpHttpStream extends McpStream {
  private readonly port: number;
  private readonly path: string;
  private sseConnection: express.Response | undefined;

  constructor(
    opts: McpServerOpts,
    tools: Map<string, ToolDefinition>,
    resources: Map<string, ResourceDefinition>
  ) {
    super(opts, tools, resources);

    if (opts.type !== McpStreamType.HTTP) {
      throw new Error("McpHttpStream can only be used with HTTP streams");
    }

    this.port = opts.port ?? DEFAULT_PORT;
    this.path = opts.path ?? "/mcp";
  }

  public async listen(): Promise<void> {
    const app = express();
    app.use(express.json());

    app.post(this.path, (req, res) => {
      console.log(
        JSON.stringify(
          {
            title: "Client connected via POST",
            path: req.path,
            params: req.params,
            body: req.body,
          },
          null,
          2
        )
      );

      this.receiveMessage(req, res);
    });

    app.get(this.path, (_req, res) => {
      console.log("Client connected via GET");

      this.startSSEConnection(res);
    });

    app.listen(this.port, () => {
      console.log(`MCP server listening on port ${this.port}`);
    });
  }

  private receiveMessage(req: express.Request, res: express.Response) {
    const bodyIsArray = Array.isArray(req.body);
    const handler = bodyIsArray ? this.handleMessages : this.handleMessage;

    handler
      .bind(this)(req.body)
      .then((result) => {
        if (!result) return res.status(204).end();

        const code =
          !Array.isArray(result) && isErrorResponse(result)
            ? JRPC_ERROR_STATUS_CODES[result.error.code] ?? 400
            : 202;

        console.log(
          JSON.stringify({ title: "Sending response", code, result }, null, 2)
        );

        this.send(result);

        return res.status(code).end();
      });
  }

  private startSSEConnection(res: express.Response) {
    this.sseConnection = res;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const sessionId = uuid();

    const dummyBase = "http://localhost"; // Any valid base works
    const endpointUrl = new URL(this.path, dummyBase);
    endpointUrl.searchParams.set("sessionId", sessionId);

    // Reconstruct the relative URL string (pathname + search + hash)
    const relativeUrlWithSession =
      endpointUrl.pathname + endpointUrl.search + endpointUrl.hash;

    res.write(`event: endpoint\ndata: ${relativeUrlWithSession}\n\n`);

    res.on("close", () => {
      console.log("Client disconnected");
      res.end();
    });
  }

  protected async send(message: object): Promise<void> {
    if (!this.sseConnection) {
      throw new Error("SSE connection not started");
    }

    this.sseConnection.write(`data: ${JSON.stringify(message)}\n\n`);
  }
}
