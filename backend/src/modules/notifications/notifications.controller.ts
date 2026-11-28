import { Body, Controller, Get, Header, HttpCode, MessageEvent, Post, Query, Sse } from '@nestjs/common'
import { defer, from, Observable, switchMap } from 'rxjs'
import { LiveService } from '../../common/realtime/live.service'
import type { AccessContext, PatientContext } from '../../common/utils/request'
import { parse } from '../../common/validation/validation'
import type { Prisma } from '../../generated/prisma/client'
import { PatientLinksService } from '../patient-auth/patient-links.service'
import { CurrentPatient, PatientRealm } from '../patient-auth/patient.decorators'
import { CurrentAccess, OrgFromQuery, OrgMember } from '../permissions/access.decorators'
import { CareScopeService } from '../scheduling/care-scope.service'
import { liveStream, patientSees, REQUEST_QUEUES, staffSees } from './live.logic'
import { listNotificationsSchema, markReadSchema } from './notifications.schemas'
import { NotificationsService } from './notifications.service'

// What a member needs to keep seeing each kind of notice. They name a patient, so they are hidden again if the
// member loses the permission.
const NOTICE_PERMISSIONS: Record<string, readonly string[]> = {
  appointment: ['bookings.view'],
  refill_request: REQUEST_QUEUES.refill,
  support_ticket: REQUEST_QUEUES.support,
}

const ownedByMember = (access: AccessContext): Prisma.NotificationWhereInput => {
  const hidden = Object.entries(NOTICE_PERMISSIONS)
    .filter(([, needed]) => !needed.some((permission) => access.permissions.has(permission)))
    .map(([entityType]) => entityType)
  return {
    orgId: access.orgId,
    membershipId: access.membershipId,
    ...(hidden.length ? { OR: [{ entityType: null }, { entityType: { notIn: hidden } }] } : {}),
  }
}

@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @OrgMember()
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.notifications.list(ownedByMember(access), parse(listNotificationsSchema, query))
    return { data: items, meta }
  }

  @Post('read')
  @HttpCode(200)
  @OrgMember()
  async read(@Body() body: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.notifications.markRead(ownedByMember(access), parse(markReadSchema, body)) }
  }
}

@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(
    private readonly live: LiveService,
    private readonly careScope: CareScopeService,
  ) {}

  // Server-Sent Events for the staff workspace: which of the things this person may see have changed.
  @Sse('stream')
  @OrgFromQuery()
  @OrgMember()
  stream(@CurrentAccess() access: AccessContext): Observable<MessageEvent> {
    return defer(() => from(this.careScope.resolve(access))).pipe(
      switchMap((scope) => {
        const viewer = { orgId: access.orgId, membershipId: access.membershipId, canViewBookings: access.permissions.has('bookings.view'), permissions: access.permissions, scope }
        return liveStream(this.live.stream(), (event) => staffSees(event, viewer))
      }),
    )
  }
}

@Controller({ path: 'patient', version: '1' })
@PatientRealm()
export class PatientNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly links: PatientLinksService,
    private readonly live: LiveService,
  ) {}

  // The account's notifications, leaving out those about a record it can no longer open.
  private async owned(accountId: string): Promise<Prisma.NotificationWhereInput> {
    const links = await this.links.active(accountId)
    return { accountId, OR: [{ patientId: null }, { patientId: { in: links.map((link) => link.patientId) } }] }
  }

  @Get('notifications')
  @Header('Cache-Control', 'no-store')
  async list(@Query() query: unknown, @CurrentPatient() patient: PatientContext) {
    const { items, ...meta } = await this.notifications.list(await this.owned(patient.accountId), parse(listNotificationsSchema, query))
    return { data: items, meta }
  }

  @Post('notifications/read')
  @HttpCode(200)
  async read(@Body() body: unknown, @CurrentPatient() patient: PatientContext) {
    return { data: await this.notifications.markRead(await this.owned(patient.accountId), parse(markReadSchema, body)) }
  }

  @Sse('events/stream')
  stream(@CurrentPatient() patient: PatientContext): Observable<MessageEvent> {
    return defer(() => from(this.links.active(patient.accountId))).pipe(
      switchMap((links) => {
        const viewer = { accountId: patient.accountId, patientIds: new Set(links.map((link) => link.patientId)) }
        // When the linked records change, the stream closes so the app reconnects with the new set.
        return liveStream(
          this.live.stream(),
          (event) => patientSees(event, viewer),
          (event) => event.topic === 'app_access' && event.accountId === patient.accountId,
        )
      }),
    )
  }
}
