import { randomUUID } from 'node:crypto'
import type { NextFunction, Response } from 'express'
import type { AppRequest } from '../utils/request'

const TRACE_ID = /^[A-Za-z0-9-]{8,64}$/

// Gives every request a trace id (reusing a well-formed X-Request-Id from a proxy) and stops any
// response containing personal data from being cached.
export function requestContext(req: AppRequest, res: Response, next: NextFunction) {
  const incoming = req.get('x-request-id')
  req.traceId = incoming && TRACE_ID.test(incoming) ? incoming : randomUUID()
  res.setHeader('X-Request-Id', req.traceId)
  res.setHeader('Cache-Control', 'no-store')
  next()
}
