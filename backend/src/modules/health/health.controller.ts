import { Controller, Get, ServiceUnavailableException, VERSION_NEUTRAL } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { Public } from '../auth/auth.decorators'

// Liveness (the process is up) and readiness (it can reach Neon) for load balancers and uptime checks.
@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live() {
    return { status: 'ok' }
  }

  @Get('ready')
  async ready() {
    if (!(await this.prisma.isReachable())) throw new ServiceUnavailableException('Database unavailable')
    return { status: 'ok' }
  }
}
