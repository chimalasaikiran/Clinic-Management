import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common'
import type { Response } from 'express'
import type { AppRequest } from '../utils/request'
import { AppError } from './app-error'

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
}

// Every error leaves the API in one envelope: { error: { code, message, details, traceId } }.
// Unexpected errors are logged with their stack and returned as a generic 500 without internals.
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors')

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp()
    const req = http.getRequest<AppRequest>()
    const res = http.getResponse<Response>()

    let status = 500
    let code = 'INTERNAL'
    let message = 'Something went wrong. Please try again.'
    let details: AppError['details'] = []

    if (exception instanceof AppError) {
      ;({ status, code, message, details } = exception)
      for (const [name, value] of Object.entries(exception.headers)) res.setHeader(name, value)
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      code = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST')
      message = status >= 500 ? message : exception.message
    } else if (isBodyParserError(exception)) {
      status = exception.status
      code = STATUS_CODES[status] ?? 'BAD_REQUEST'
      message = status === 413 ? 'The request is too large.' : 'The request body is not valid JSON.'
    }

    // Deliberate 5xx responses (for example "not ready" from the health check) are not bugs; everything else is.
    const deliberate = exception instanceof AppError || exception instanceof HttpException
    if (status >= 500 && !deliberate) this.logger.error({ err: exception, traceId: req.traceId }, 'Unhandled error')

    res.status(status).json({ error: { code, message, details, traceId: req.traceId } })
  }
}

function isBodyParserError(error: unknown): error is { status: number; type: string } {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error && typeof error.status === 'number'
}
