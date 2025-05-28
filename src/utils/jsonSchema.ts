import Ajv from "ajv";
import { SafeReturn } from "../jrpc/error";

export const validateJsonSchema = (
  schema: object,
  data: object
): SafeReturn<object> => {
  const ajv = new Ajv();

  const isValidSchema = ajv.validateSchema(schema);
  if (!isValidSchema) {
    throw new Error(`Invalid schema: ${JSON.stringify(ajv.errors)}`);
  }

  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    return {
      success: false,
      error: validate.errors,
    };
  }
  return { success: true, data: data as object };
};
