import { Controller, Get, Query } from '@nestjs/common'
import { z } from 'zod'
import type { AccessContext } from '../../common/utils/request'
import { isoDate, parse, uuid } from '../../common/validation/validation'
import { CurrentAccess, OrgMember, RequirePermissions } from '../permissions/access.decorators'
import { DashboardService } from './dashboard.service'

export const dashboardQuery = z.object({ date: isoDate.optional(), branchId: uuid.optional() })
export const alertsQuery = z.object({ branchId: uuid.optional() })

@Controller({ path: 'dashboard', version: '1' })
@RequirePermissions('dashboard.view')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  async overview(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.dashboard.overview(access, parse(dashboardQuery, query)) }
  }
}

// The header's alerts are open to every member; each item inside needs its own permission.
@Controller({ path: 'alerts', version: '1' })
@OrgMember()
export class AlertsController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.dashboard.alerts(access, parse(alertsQuery, query)) }
  }
}
