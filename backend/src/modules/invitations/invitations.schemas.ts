import { z } from 'zod'
import { email, password, personName, uuid } from '../../common/validation/validation'

export const createInvitationSchema = z.object({ email, roleIds: z.array(uuid).min(1, 'Choose at least one role.').max(20) })
// 32 random bytes in base64url.
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid invitation link.')
export const tokenOnlySchema = z.object({ token: invitationTokenSchema })
export const acceptNewSchema = z.object({ token: invitationTokenSchema, fullName: personName, password })
