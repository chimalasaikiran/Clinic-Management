import { Injectable } from '@nestjs/common'
import { AuditService } from '../../common/audit/audit.service'
import { notFound } from '../../common/errors/app-error'
import type { ClientInfo } from '../../common/utils/request'
import type { User } from '../../generated/prisma/client'
import { UsersRepository } from './users.repository'

// What the API ever reveals about a user account. Password hashes and lock state never leave the server.
export const publicUser = (user: Pick<User, 'id' | 'email' | 'fullName' | 'emailVerifiedAt'>) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  emailVerified: user.emailVerifiedAt !== null,
})

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly audit: AuditService,
  ) {}

  async profile(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw notFound('Account not found.')
    return publicUser(user)
  }

  async updateProfile(userId: string, input: { fullName: string }, client: ClientInfo) {
    const user = await this.users.updateProfile(userId, input)
    await this.audit.record({ action: 'user.profile_updated', entityType: 'user', entityId: userId, actorUserId: userId }, client)
    return publicUser(user)
  }
}
