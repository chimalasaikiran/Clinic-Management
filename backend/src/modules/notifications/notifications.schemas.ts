import { z } from 'zod'
import { uuid } from '../../common/validation/validation'

export const listNotificationsSchema = z.object({
  // The `nextCursor` of the previous page.
  cursor: uuid.optional(),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

// Either named notifications, or everything unread.
export const markReadSchema = z.union([z.object({ ids: z.array(uuid).min(1).max(100) }), z.object({ all: z.literal(true) })], { error: 'Choose which notifications to mark as read.' })

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>
export type MarkReadInput = z.infer<typeof markReadSchema>
