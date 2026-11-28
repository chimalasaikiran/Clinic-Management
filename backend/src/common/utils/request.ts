import type { Request } from 'express'

// What the API knows about the signed-in person for the current request (set by SessionGuard).
export interface AuthContext {
  userId: string
  sessionId: string
  email: string
  emailVerified: boolean
}

// Organisation access for the current request (set by AccessGuard from the X-Org-Id header).
export interface AccessContext {
  orgId: string
  membershipId: string
  permissions: ReadonlySet<string>
  // 'all' for anyone holding an organisation-wide role; otherwise the branches their roles cover.
  branchScope: 'all' | readonly string[]
}

// The signed-in patient app account (set by PatientGuard). A different realm from staff: never both.
export interface PatientContext {
  accountId: string
  sessionId: string
}

export interface AppRequest extends Request {
  traceId: string
  patient?: PatientContext
  auth?: AuthContext
  access?: AccessContext
}

export interface ClientInfo {
  ip: string | null
  userAgent: string | null
  traceId: string | null
}

export const clientInfo = (req: AppRequest): ClientInfo => ({
  ip: req.ip ?? null,
  userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
  traceId: req.traceId ?? null,
})
