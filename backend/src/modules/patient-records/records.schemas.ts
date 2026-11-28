import { z } from 'zod'
import { pagination } from '../../common/validation/validation'

export const recordListSchema = pagination(50)

export const orderListSchema = pagination(50).extend({
  // `results`: orders whose test has been done or is under way, as the lab reports screen lists them.
  scope: z.enum(['all', 'results']).default('all'),
})

export type RecordListQuery = z.infer<typeof recordListSchema>
export type OrderListQuery = z.infer<typeof orderListSchema>
