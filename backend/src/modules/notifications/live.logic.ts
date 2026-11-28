import type { MessageEvent } from '@nestjs/common'
import { filter, interval, map, merge, Observable, startWith, takeUntil, timer } from 'rxjs'
import type { LiveEvent } from '../../common/realtime/live.service'
import type { CareScope } from '../scheduling/care-scope.service'

// Keeps proxies from closing an idle stream.
export const HEARTBEAT_MS = 25_000
// A stream is closed after this long and the client reconnects, which checks the session, the permissions and
// the linked records again. Signing out or losing a role therefore stops the stream within this time.
export const STREAM_MAX_MS = 5 * 60_000

export interface StaffViewer {
  orgId: string
  membershipId: string
  canViewBookings: boolean
  permissions: ReadonlySet<string>
  scope: CareScope
}

// Who works each request queue; the same rule as the queue routes.
export const REQUEST_QUEUES = {
  refill: ['pharmacy.view', 'clinical.read'],
  support: ['patients.view'],
} as const

export function staffSees(event: LiveEvent, viewer: StaffViewer): boolean {
  if (event.orgId !== viewer.orgId) return false
  if (event.topic === 'notifications') return event.membershipId === viewer.membershipId
  if (event.topic === 'requests') {
    const inBranch = viewer.scope.branches === 'all' || viewer.scope.branches.includes(event.branchId)
    return inBranch && REQUEST_QUEUES[event.kind].some((permission) => viewer.permissions.has(permission))
  }
  // Only an id travels with the event; the chart itself is read through the clinical routes and their scope.
  if (event.topic === 'records') return viewer.permissions.has('clinical.read') && (viewer.scope.branches === 'all' || viewer.scope.branches.includes(event.branchId))
  if (event.topic !== 'appointments' || !viewer.canViewBookings) return false
  const { appointments, branches } = viewer.scope
  if (appointments === 'none') return false
  if (branches !== 'all' && !branches.includes(event.branchId)) return false
  if (appointments === 'all') return true
  return event.practitionerId === appointments.practitionerId || event.previousPractitionerId === appointments.practitionerId
}

export interface PatientViewer {
  accountId: string
  patientIds: ReadonlySet<string>
}

export function patientSees(event: LiveEvent, viewer: PatientViewer): boolean {
  if (event.topic === 'appointments' || event.topic === 'records' || event.topic === 'requests') return viewer.patientIds.has(event.patientId)
  return event.accountId === viewer.accountId
}

// The Server-Sent Events body: "ready" first (the client reloads what it shows), then one event per change.
export function liveStream(source: Observable<LiveEvent>, sees: (event: LiveEvent) => boolean, closeWhen: (event: LiveEvent) => boolean = () => false): Observable<MessageEvent> {
  const changes = source.pipe(
    filter(sees),
    map((event): MessageEvent => ({ type: event.topic, data: { id: event.entityId } })),
  )
  const heartbeat = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'heartbeat', data: {} })))
  return merge(changes, heartbeat).pipe(startWith<MessageEvent>({ type: 'ready', data: {} }), takeUntil(merge(timer(STREAM_MAX_MS), source.pipe(filter(closeWhen)))))
}
