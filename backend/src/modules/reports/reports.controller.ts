import { Controller, Get, Query } from '@nestjs/common'
import { z } from 'zod'
import type { AccessContext } from '../../common/utils/request'
import { isoDate, parse, uuid } from '../../common/validation/validation'
import { CurrentAccess, RequirePermissions } from '../permissions/access.decorators'
import { ReportsService } from './reports.service'

const DAY = 24 * 60 * 60 * 1000
export const periodSchema = z
  .object({ from: isoDate, to: isoDate, branchId: uuid.optional() })
  .refine((value) => value.from <= value.to, { path: ['to'], message: 'The end date must be on or after the start date.' })
  .refine((value) => (Date.parse(value.to) - Date.parse(value.from)) / DAY < 366, { path: ['to'], message: 'Choose a period of at most a year.' })

@Controller({ path: 'reports', version: '1' })
@RequirePermissions('reports.view')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('operations')
  async operations(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.reports.operations(access, parse(periodSchema, query)) }
  }
}
