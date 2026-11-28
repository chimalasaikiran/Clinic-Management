import { Injectable } from '@nestjs/common'
import type { AccessContext } from '../../common/utils/request'
import { PractitionersRepository } from './practitioners.repository'

// Which patients and appointments a member works with, on top of their permissions:
//  - Members who can create bookings (front desk, managers, owners) work with every patient, and with the
//    appointments at the branches their roles cover.
//  - Nursing staff (clinical.vitals) prepare whoever arrives, so they work the same way within their branches.
//  - A therapist who cannot create bookings sees only their own appointments and the patients booked with them.
//  - Anyone else with patient access (for example pharmacy) can look patients up but sees no appointments.
export interface CareScope {
  // 'all', or the only practitioner whose appointments are visible, or 'none'.
  appointments: 'all' | 'none' | { practitionerId: string }
  // 'all', or only patients who have an appointment with this practitioner.
  patients: 'all' | { practitionerId: string }
  branches: 'all' | readonly string[]
}

@Injectable()
export class CareScopeService {
  constructor(private readonly practitioners: PractitionersRepository) {}

  async resolve(access: AccessContext): Promise<CareScope> {
    const branches = access.branchScope
    if (access.permissions.has('bookings.create') || access.permissions.has('clinical.vitals')) return { appointments: 'all', patients: 'all', branches }
    const practitioner = await this.practitioners.findByMembership(access.membershipId)
    if (practitioner) return { appointments: { practitionerId: practitioner.id }, patients: { practitionerId: practitioner.id }, branches }
    return { appointments: 'none', patients: 'all', branches }
  }
}

export const branchAllowed = (scope: CareScope, branchId: string) => scope.branches === 'all' || scope.branches.includes(branchId)
