import type { ErrorSerializer } from "../types/index";
import { INTERNAL_ERROR_MESSAGE } from "./defaults";

export const serializeErrorResponse: ErrorSerializer = (error, context) => {
  const message = error.isOperational ? error.message : INTERNAL_ERROR_MESSAGE;
  const details = error.isOperational ? error.details : undefined;
  return {
    success: false,
    data: null,
    error: { message, ...(details === undefined ? {} : { details }) },
    ...(context.requestId === undefined ? {} : { requestId: context.requestId })
  };
};
