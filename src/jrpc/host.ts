import { ZodSchema } from "zod";
import {
  JRPC_Request,
  JRPC_Request_Schema,
  JRPC_Response,
  SafeReturn,
  ValidationPipe,
} from "./types";
import {
  JRPC_Error,
  JRPCException,
  JRPCInternalError,
  JRPCInvalidParams,
  JRPCMethodNotFound,
  JRPCParseError,
} from "./error";

type MethodDefinition<
  TInput extends ZodSchema = any,
  TOutput extends object = any
> = {
  name: string;
  handler: (data: TInput) => Promise<TOutput>;
  pipes?: ValidationPipe[];
};

export class JRPCHost {
  private methodMap: Map<string, MethodDefinition> = new Map();

  public async handleMessages(
    requests: object[]
  ): Promise<JRPC_Response[] | JRPC_Response> {
    const responses = await Promise.all(requests.map(this.handleMessage));
    const nonEmptyResponses = responses.filter((r) => !!r);

    if (!nonEmptyResponses.length)
      return { jsonrpc: "2.0", id: null, error: JRPCParseError(null) };

    return nonEmptyResponses;
  }

  public async handleMessage(
    request: object
  ): Promise<JRPC_Response | undefined> {
    const parse = this.validateRequest(request);
    if (!parse.success) {
      return {
        id: (request as any).id ?? null,
        jsonrpc: "2.0",
        error: parse.error,
      };
    }

    const { req, method } = parse.data;

    const processPromise = this.processRequest(method, req);

    if (!req.id) return;

    const res = await processPromise;

    return res.success
      ? {
          jsonrpc: "2.0",
          id: req.id,
          result: res.data,
        }
      : {
          jsonrpc: "2.0",
          id: req.id,
          error: res.error,
        };
  }

  public buildMessage(message: object, req?: JRPC_Request): JRPC_Response {
    return req?.id
      ? {
          jsonrpc: "2.0",
          id: req.id,
          result: message,
        }
      : {
          jsonrpc: "2.0",
          id: null,
          result: message,
        };
  }

  public buildError(error: JRPC_Error, req?: JRPC_Request): JRPC_Response {
    return req?.id
      ? {
          jsonrpc: "2.0",
          id: req.id,
          error,
        }
      : {
          jsonrpc: "2.0",
          id: null,
          error,
        };
  }

  public registerMethod(
    name: string,
    handler: (data: any) => Promise<any>,
    pipes?: ValidationPipe[]
  ) {
    const method: MethodDefinition = {
      name,
      handler,
      pipes,
    };

    if (this.methodMap.has(method.name))
      throw new Error(`Method with name ${method.name} already registered.`);

    this.methodMap.set(method.name, method);
  }

  private async processRequest(
    method: MethodDefinition,
    data: JRPC_Request
  ): Promise<SafeReturn<any, JRPC_Error>> {
    const validationErr = await this.runPipes(method, data);
    if (validationErr) return { success: false, error: validationErr };

    try {
      const response = await method.handler(data.params);

      return {
        success: true,
        data: response,
      };
    } catch (e) {
      if (e instanceof JRPCException) {
        return {
          success: false,
          error: {
            code: e.code,
            message: e.description,
            data: e.data,
          },
        };
      }

      console.error("Error during application message processing", e);
      return { success: false, error: JRPCInternalError() };
    }
  }
  private async runPipes(
    method: MethodDefinition,
    data: JRPC_Request
  ): Promise<JRPC_Error | void> {
    const errors: any[] = [];

    for (const pipe of method.pipes ?? []) {
      try {
        const res = await pipe.run(data.params);
        if (res.success) {
          data.params = res.data;
          continue;
        }
        errors.push(res.error);
      } catch (e) {
        console.error("Error on validation pipe", e);
        return JRPCInternalError();
      }
    }

    if (!errors.length) return;

    return JRPCInvalidParams(errors);
  }

  private validateRequest(
    request: object
  ): SafeReturn<{ req: JRPC_Request; method: MethodDefinition }, JRPC_Error> {
    const parse = JRPC_Request_Schema.safeParse(request);

    if (parse.success) {
      const method = this.methodMap.get(parse.data.method);

      if (!method)
        return {
          success: false,
          error: JRPCMethodNotFound(parse.data.method),
        };

      return {
        success: parse.success,
        data: {
          req: parse.data,
          method,
        },
      };
    }

    return {
      success: parse.success,
      error: JRPCParseError(parse.error),
    };
  }
}
