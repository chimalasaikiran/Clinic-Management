import { Controller, Get, Query } from '@nestjs/common'
import { z } from 'zod'
import type { AccessContext } from '../../common/utils/request'
import { parse } from '../../common/validation/validation'
import { CurrentAccess, OrgMember } from '../permissions/access.decorators'
import { SearchService } from './search.service'

export const searchQuery = z.object({ q: z.string().trim().min(2, 'Type at least 2 characters.').max(100) })

// Open to every member; each group of results needs its own permission.
@Controller({ path: 'search', version: '1' })
@OrgMember()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.searchService.search(access, parse(searchQuery, query).q) }
  }
}
