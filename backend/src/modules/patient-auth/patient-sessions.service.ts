import { Inject, Injectable } from '@nestjs/common'
import { forbidden, unauthorized } from '../../common/errors/app-error'
import { generateToken, keyedHash } from '../../common/utils/crypto'
import type { ClientInfo, PatientContext } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { Db, PrismaService } from '../../database/prisma.service'

export const MAX_PATIENT_SESSIONS = 10
// lastSeenAt is written at most this often, so an open app does not cause a write per request.
const TOUCH_INTERVAL_MS = 5 * 60_000
const DAY_MS = 86_400_000

export const patientSessionEnded = {
  missing: () => unauthorized('SESSION_MISSING', 'Sign in to continue.'),
  invalid: () => unauthorized('SESSION_INVALID', 'You have been signed out. Sign in again.'),
  expired: () => unauthorized('SESSION_EXPIRED', 'Your session has expired. Sign in again.'),
  disabled: () => forbidden('ACCOUNT_DISABLED', 'This account is disabled. Contact your clinic.'),
}

export interface Device {
  deviceName: string
  platform: string
}

// The app holds a random 256-bit token in the phone's secure storage; the database holds only its keyed hash.
@Injectable()
export class PatientSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async start(accountId: string, device: Device, client: ClientInfo, db: Db = this.prisma) {
    const token = generateToken()
    const expiresAt = new Date(Date.now() + this.env.PATIENT_SESSION_MAX_DAYS * DAY_MS)
    await db.patientSession.create({
      data: { accountId, tokenHash: this.hash(token), expiresAt, ip: client.ip, deviceName: device.deviceName, platform: device.platform },
      select: { id: true },
    })
    // The newest sessions are kept; a phone left signed in long ago drops off first.
    const surplus = await db.patientSession.findMany({ where: { accountId, revokedAt: null }, orderBy: { createdAt: 'desc' }, skip: MAX_PATIENT_SESSIONS, select: { id: true } })
    if (surplus.length) await db.patientSession.updateMany({ where: { id: { in: surplus.map((row) => row.id) } }, data: { revokedAt: new Date() } })
    return { token, expiresAt }
  }

  async authenticate(token: string): Promise<PatientContext> {
    const session = await this.prisma.patientSession.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { account: { select: { status: true } } },
    })
    if (!session || session.revokedAt) throw patientSessionEnded.invalid()

    const now = Date.now()
    if (session.expiresAt.getTime() <= now || now - session.lastSeenAt.getTime() > this.env.PATIENT_SESSION_IDLE_DAYS * DAY_MS) {
      await this.end(session.accountId, session.id)
      throw patientSessionEnded.expired()
    }
    if (session.account.status !== 'active') {
      await this.end(session.accountId, session.id)
      throw patientSessionEnded.disabled()
    }
    if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.patientSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) }, select: { id: true } })
    }
    return { accountId: session.accountId, sessionId: session.id }
  }

  async list(patient: PatientContext) {
    const rows = await this.prisma.patientSession.findMany({
      where: { accountId: patient.accountId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, deviceName: true, platform: true, createdAt: true, lastSeenAt: true },
    })
    return rows.map((row) => ({ ...row, current: row.id === patient.sessionId }))
  }

  // Scoped to the account, so one patient can never end another's session. Returns whether anything ended.
  async end(accountId: string, sessionId: string) {
    const { count } = await this.prisma.patientSession.updateMany({ where: { id: sessionId, accountId, revokedAt: null }, data: { revokedAt: new Date() } })
    return count > 0
  }

  async endOthers(patient: PatientContext) {
    const { count } = await this.prisma.patientSession.updateMany({
      where: { accountId: patient.accountId, id: { not: patient.sessionId }, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return count
  }

  private hash(token: string) {
    return keyedHash(this.env.TOKEN_PEPPER, `patient-session:${token}`)
  }
}
