import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { PaginationParams } from "../contract";
import { ResponseFormatter } from "../core";

export class HonoResponse {
  static success<T>(
    c: Context,
    data: T,
    message = "Request completed successfully",
    statusCode: ContentfulStatusCode = 200,
    requestId?: string
  ) {
    return c.json(ResponseFormatter.success(data, message, requestId), statusCode);
  }

  static paginated<T>(
    c: Context,
    data: T,
    message: string,
    pagination: PaginationParams,
    statusCode: ContentfulStatusCode = 200,
    requestId?: string
  ) {
    return c.json(ResponseFormatter.paginated(data, message, pagination, requestId), statusCode);
  }

  static error(
    c: Context,
    statusCode: ContentfulStatusCode,
    message: string,
    details?: unknown,
    requestId?: string
  ) {
    return c.json(
      ResponseFormatter.error(
        {
          message,
          ...(details ? { details } : {})
        },
        requestId
      ),
      statusCode
    );
  }
}
