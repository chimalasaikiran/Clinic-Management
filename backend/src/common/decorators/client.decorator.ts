import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { clientInfo, type AppRequest } from '../utils/request'

// IP address, user agent and trace id of the caller, for audit entries and rate limits.
export const Client = createParamDecorator((_: unknown, ctx: ExecutionContext) => clientInfo(ctx.switchToHttp().getRequest<AppRequest>()))
