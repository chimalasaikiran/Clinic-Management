import type { CookieOptions, Request, Response } from 'express'
import type { Env } from '../../config/env'

// "__Host-" makes the browser refuse the cookie unless it is Secure, host-only and Path=/,
// so a sibling subdomain cannot set or overwrite it. Plain HTTP (local development) cannot use the prefix.
export const sessionCookieName = (env: Env) => (env.COOKIE_SECURE ? '__Host-clinicos_session' : 'clinicos_session')

function options(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
  }
}

export function setSessionCookie(res: Response, env: Env, token: string, expiresAt: Date) {
  res.cookie(sessionCookieName(env), token, { ...options(env), expires: expiresAt })
}

export function clearSessionCookie(res: Response, env: Env) {
  res.clearCookie(sessionCookieName(env), options(env))
}

export function readSessionCookie(req: Request, env: Env): string | null {
  const value: unknown = req.cookies?.[sessionCookieName(env)]
  // Tokens are 43 base64url characters; anything else is not worth a database lookup.
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
}
