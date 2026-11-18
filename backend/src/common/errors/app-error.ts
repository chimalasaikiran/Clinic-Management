export interface ErrorDetail {
  field?: string
  issue: string
}

// An error that is safe to show to the client: a stable code, an HTTP status and a plain message.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
    readonly headers: Record<string, string> = {},
  ) {
    super(message)
  }
}

export const badRequest = (code: string, message: string, details?: ErrorDetail[]) => new AppError(400, code, message, details)
export const unauthorized = (code: string, message: string) => new AppError(401, code, message)
export const forbidden = (code: string, message: string) => new AppError(403, code, message)
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message)
export const conflict = (code: string, message: string, details?: ErrorDetail[]) => new AppError(409, code, message, details)
export const unprocessable = (code: string, message: string) => new AppError(422, code, message)
export const tooManyRequests = (retryAfterSeconds: number, message = 'Too many attempts. Please wait and try again.') =>
  new AppError(429, 'RATE_LIMITED', message, [], { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) })
