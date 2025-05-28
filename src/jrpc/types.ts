import { z } from "zod";
import { JRPC_Error } from "./error";

export type SafeReturn<TRet = any, TErr = any> =
  | {
      success: true;
      data: TRet;
    }
  | {
      success: false;
      error: TErr;
    };

const JRPC_Params_Schema = z
  .instanceof(Object)
  .or(z.instanceof(Array))
  .optional();
export type JRPC_Params = z.infer<typeof JRPC_Params_Schema>;

export const JRPC_Request_Schema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string().min(0),
  params: JRPC_Params_Schema,
  id: z
    .string()
    .or(z.number())
    .nullable()
    .optional()
    .transform((value) => (value !== null ? value?.toString() : null)),
});

export type JRPC_Request = z.infer<typeof JRPC_Request_Schema>;

export type JRPC_Response = {
  jsonrpc: "2.0";
  id: string | null;
  result?: any;
  error?: JRPC_Error;
};

export const isErrorResponse = (
  response: JRPC_Response
): response is JRPC_Response & { error: JRPC_Error } => {
  return response.error !== undefined;
};

export const isSuccessResponse = (
  response: JRPC_Response
): response is JRPC_Response & { result: any } => {
  return response.result !== undefined;
};

export interface ValidationPipe {
  run(params: JRPC_Params): Promise<SafeReturn>;
}
