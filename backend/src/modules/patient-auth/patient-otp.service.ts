import { Inject, Injectable } from '@nestjs/common'
import { SmsService } from '../../common/sms/sms.service'
import { generateCode, generateToken, hashesMatch, keyedHash } from '../../common/utils/crypto'
import { ENV, Env } from '../../config/env'
import { PrismaService, Tx } from '../../database/prisma.service'

export const OTP_TTL_SECONDS = 5 * 60
export const OTP_RESEND_SECONDS = 30
export const OTP_MAX_ATTEMPTS = 5
// How long a verified new number has to finish creating its account.
const TICKET_TTL_MS = 30 * 60_000

@Injectable()
export class PatientOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // The answer is the same whether or not the number has an account.
  async send(mobile: string) {
    const latest = await this.prisma.patientOtp.findFirst({ where: { mobile }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, consumedAt: true } })
    if (latest && !latest.consumedAt) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000
      if (elapsed < OTP_RESEND_SECONDS) return { resendInSeconds: Math.ceil(OTP_RESEND_SECONDS - elapsed), expiresInSeconds: OTP_TTL_SECONDS }
    }

    const code = generateCode()
    await this.prisma.patientOtp.updateMany({ where: { mobile, consumedAt: null }, data: { consumedAt: new Date() } })
    const row = await this.prisma.patientOtp.create({
      data: { mobile, codeHash: this.hash(mobile, code), expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000) },
      select: { id: true },
    })
    try {
      await this.sms.sendCode(mobile, code)
    } catch (error) {
      // A code that never left must not start the resend cooldown.
      await this.prisma.patientOtp.delete({ where: { id: row.id } })
      throw error
    }
    return { resendInSeconds: OTP_RESEND_SECONDS, expiresInSeconds: OTP_TTL_SECONDS }
  }

  // Runs in its own transaction, which commits even when the code is wrong so the attempt is counted.
  // The row lock stops parallel guesses from sharing one attempt.
  consume(mobile: string, code: string) {
    return this.prisma.transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; code_hash: string; attempts: number; expired: boolean }>>`
        select id, code_hash, attempts, expires_at <= now() as expired from patient_otps
        where mobile = ${mobile} and consumed_at is null
        order by created_at desc limit 1 for update`
      const row = rows[0]
      if (!row || row.expired || row.attempts >= OTP_MAX_ATTEMPTS) return null

      const matches = hashesMatch(row.code_hash, this.hash(mobile, code))
      const attempts = row.attempts + 1
      await tx.patientOtp.update({
        where: { id: row.id },
        data: { attempts, consumedAt: matches || attempts >= OTP_MAX_ATTEMPTS ? new Date() : null },
      })
      return matches ? { id: row.id } : null
    })
  }

  // For a verified number without an account: a single-use ticket that proves the number during registration.
  async issueTicket(otpId: string) {
    const token = generateToken()
    await this.prisma.patientOtp.update({ where: { id: otpId }, data: { ticketHash: this.ticketHash(token), expiresAt: new Date(Date.now() + TICKET_TTL_MS) } })
    return token
  }

  // Claims the ticket inside the registration transaction, so it creates at most one account.
  async claimTicket(token: string, tx: Tx) {
    const ticketHash = this.ticketHash(token)
    const row = await tx.patientOtp.findUnique({ where: { ticketHash }, select: { mobile: true, expiresAt: true } })
    if (!row || row.expiresAt.getTime() <= Date.now()) return null
    const { count } = await tx.patientOtp.updateMany({ where: { ticketHash }, data: { ticketHash: null } })
    return count === 1 ? row.mobile : null
  }

  prune(before: Date) {
    return this.prisma.patientOtp.deleteMany({ where: { expiresAt: { lt: before } } })
  }

  private hash(mobile: string, code: string) {
    return keyedHash(this.env.TOKEN_PEPPER, `patient-otp:${mobile}:${code}`)
  }

  private ticketHash(token: string) {
    return keyedHash(this.env.TOKEN_PEPPER, `patient-ticket:${token}`)
  }
}
