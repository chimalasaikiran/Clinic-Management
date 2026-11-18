import { Injectable } from '@nestjs/common'
import { Db, PrismaService } from '../../database/prisma.service'

export interface NewUser {
  email: string
  fullName: string
  passwordHash: string
  verified: boolean
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string, db: Db = this.prisma) {
    return db.user.findUnique({ where: { email } })
  }

  findById(id: string, db: Db = this.prisma) {
    return db.user.findUnique({ where: { id } })
  }

  create(input: NewUser, db: Db = this.prisma) {
    return db.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.verified ? new Date() : null,
      },
    })
  }

  markEmailVerified(id: string, db: Db = this.prisma) {
    return db.user.updateMany({ where: { id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } })
  }

  // Returns the new count of consecutive failures.
  async recordFailedLogin(id: string): Promise<number> {
    const user = await this.prisma.user.update({ where: { id }, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true } })
    return user.failedLoginCount
  }

  lock(id: string, until: Date) {
    return this.prisma.user.update({ where: { id }, data: { lockedUntil: until, failedLoginCount: 0 } })
  }

  recordSuccessfulLogin(id: string, db: Db = this.prisma) {
    return db.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } })
  }

  // Also clears any sign-in lock: the person has just proved they control the account.
  setPassword(id: string, passwordHash: string, db: Db = this.prisma) {
    return db.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } })
  }

  updateProfile(id: string, data: { fullName: string }) {
    return this.prisma.user.update({ where: { id }, data })
  }
}
