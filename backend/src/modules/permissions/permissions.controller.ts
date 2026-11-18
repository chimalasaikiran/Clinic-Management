import { Controller, Get } from '@nestjs/common'
import { OrgMember } from './access.decorators'
import { PERMISSION_GROUPS } from './permission-catalogue'

@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  @Get()
  @OrgMember()
  list() {
    return { data: PERMISSION_GROUPS }
  }
}
