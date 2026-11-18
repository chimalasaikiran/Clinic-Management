import type { NextFunction, Request, Response } from 'express'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// CSRF protection for cookie sessions, on top of SameSite cookies: a request that changes something must come
// from one of the admin panel's origins. Browsers always send Origin on cross-origin and on POST/PUT/PATCH/DELETE
// fetches, so a forged form or script on another site is rejected here. Requests without Origin and without a
// session cookie (server-to-server calls, curl) carry no ambient credentials and are let through.
export function originCheck(allowedOrigins: readonly string[], sessionCookieName: string) {
  const allowed = new Set(allowedOrigins)
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next()

    const origin = req.get('origin') ?? originOf(req.get('referer'))
    const hasSessionCookie = Boolean(req.cookies?.[sessionCookieName])
    if (origin ? allowed.has(origin) : !hasSessionCookie) return next()

    res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This request did not come from ClinicOS.', details: [], traceId: (req as Request & { traceId?: string }).traceId } })
  }
}

function originOf(referer: string | undefined): string | null {
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}
