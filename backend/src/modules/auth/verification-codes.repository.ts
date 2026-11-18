import { Injectable } from '@nestjs/common'
import { Db, PrismaService, Tx } from '../../database/prisma.service'
import { CodePurpose } from '../../generated/prisma/client'

export interface LockedCode {
  id: string
  code_hash: string
  attempts: number
  expired: boolean
}

@Injectable()
export class VerificationCodesRepository {
  constructor(private readonly prisma: PrismaService) {}

  latestIssuedAt(userId: string, purpose: CodePurpose, db: Db = this.prisma) {
    return db.verificationCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  }

  retireActive(userId: string, purpose: CodePurpose, db: Db = this.prisma) {
    return db.verificationCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } })
  }

  create(data: { userId: string; purpose: CodePurpose; codeHash: string; expiresAt: Date }, db: Db = this.prisma) {
    return db.verificationCode.create({ data, select: { id: true } })
  }

  // Locks the live code row so parallel guesses are counted one after another.
  async lockLatestActive(userId: string, purpose: CodePurpose, tx: Tx): Promise<LockedCode | undefined> {
    const rows = await tx.$queryRaw<LockedCode[]>`
      select id, code_hash, attempts, expires_at <= now() as expired
      from verification_codes
      where user_id = ${userId}::uuid and purpose = ${purpose}::code_purpose and consumed_at is null
      order by created_at desc
      limit 1
      for update`
    return rows[0]
  }

  recordAttempt(id: string, attempts: number, consumed: boolean, tx: Tx) {
    return tx.verificationCode.update({ where: { id }, data: { attempts, consumedAt: consumed ? new Date() : null } })
  }

  deleteFinished(before: Date) {
    return this.prisma.verificationCode.deleteMany({ where: { OR: [{ expiresAt: { lt: before } }, { consumedAt: { lt: before } }] } })
  }
}
