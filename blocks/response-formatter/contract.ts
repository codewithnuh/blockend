export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
}

export interface PaginationMeta extends PaginationParams {
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  requestId?: string;
  meta?: PaginationMeta;
}

export interface ErrorResponse {
  success: false;
  data: null;
  error: {
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
