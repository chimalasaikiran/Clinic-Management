import { z } from 'zod'
import { email, existingPassword, otpCode, password, personName } from '../../common/validation/validation'

export const registerSchema = z.object({ fullName: personName, email, password })
export const loginSchema = z.object({ email, password: existingPassword })
export const confirmEmailSchema = z.object({ email, code: otpCode })
export const emailOnlySchema = z.object({ email })
export const resetSchema = z.object({ email, code: otpCode, password })
export const changePasswordSchema = z.object({ currentPassword: existingPassword, newPassword: password })

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ResetInput = z.infer<typeof resetSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
