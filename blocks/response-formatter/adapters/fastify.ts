import type { FastifyReply } from "fastify";

import type { PaginationParams } from "../contract";
import { ResponseFormatter } from "../core";

export class FastifyResponse {
  static success<T>(
    reply: FastifyReply,
    data: T,
    message = "Request completed successfully",
    statusCode = 200,
    requestId?: string
  ) {
    return reply.status(statusCode).send(ResponseFormatter.success(data, message, requestId));
  }

  static paginated<T>(
    reply: FastifyReply,
    data: T,
    message: string,
    pagination: PaginationParams,
    statusCode = 200,
    requestId?: string
  ) {
    return reply
      .status(statusCode)
      .send(ResponseFormatter.paginated(data, message, pagination, requestId));
  }

  static error(
    reply: FastifyReply,
    statusCode: number,
    message: string,
    details?: unknown,
    requestId?: string
  ) {
    return reply.status(statusCode).send(
      ResponseFormatter.error(
        {
          message,
          ...(details ? { details } : {})
        },
        requestId
      )
    );
  }
}
