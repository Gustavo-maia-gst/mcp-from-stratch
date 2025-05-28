export type SafeReturn<TRet = any, TErr = any> =
  | {
      success: true;
      data: TRet;
    }
  | {
      success: false;
      error: TErr;
    };

export type JRPC_Error = {
  code: number;
  message: string;
  data?: any;
};

export enum JRPC_ErrorCodes {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

export const JRPCParseError = (error: any): JRPC_Error => ({
  code: JRPC_ErrorCodes.PARSE_ERROR,
  message: "Parse Error",
  data: error,
});
export const JRPCInvalidRequest = (error: any): JRPC_Error => ({
  code: JRPC_ErrorCodes.INVALID_REQUEST,
  message: "Invalid Request",
  data: error,
});
export const JRPCMethodNotFound = (method: string): JRPC_Error => ({
  code: JRPC_ErrorCodes.METHOD_NOT_FOUND,
  message: `Method ${method} not found`,
});
export const JRPCInvalidParams = (error: any): JRPC_Error => ({
  code: JRPC_ErrorCodes.INVALID_PARAMS,
  message: "Invalid params",
  data: error,
});
export const JRPCInternalError = (): JRPC_Error => ({
  code: JRPC_ErrorCodes.INTERNAL_ERROR,
  message: "Internal Error",
});

export class JRPCException extends Error {
  public readonly code: JRPC_ErrorCodes;
  public readonly description: string;
  public readonly data?: any;

  constructor(code: JRPC_ErrorCodes, message: string, data?: any) {
    super(message);
    this.code = code;
    this.description = message;
    this.data = data;
  }
}
