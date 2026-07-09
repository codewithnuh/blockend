import type { Response } from "express";

import type { PaginationParams } from "../contract";
import { ResponseFormatter } from "../core";

export class ExpressResponse {
  static success<T>(
    res: Response,
    data: T,
    message = "Request completed successfully",
    statusCode = 200,
    requestId?: string
  ) {
    return res.status(statusCode).json(ResponseFormatter.success(data, message, requestId));
  }

  static paginated<T>(
    res: Response,
    data: T,
    message: string,
    pagination: PaginationParams,
    statusCode = 200,
    requestId?: string
  ) {
    return res
      .status(statusCode)
      .json(ResponseFormatter.paginated(data, message, pagination, requestId));
  }

  static error(
    res: Response,
    statusCode: number,
    message: string,
    details?: unknown,
    requestId?: string
  ) {
    return res.status(statusCode).json(
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
