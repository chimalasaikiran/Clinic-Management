import { Injectable } from '@nestjs/common'
import type { AccessContext } from '../../common/utils/request'
import { CarePlansService } from './care-plans.service'
import { ClinicalService } from './clinical.service'
import { OrdersService } from './orders.service'
import { PrescriptionsService } from './prescriptions.service'
import { ReferralsService } from './referrals.service'

// The whole chart in one response: the clinical core plus prescriptions, orders, referrals and care plans.
@Injectable()
export class ChartService {
  constructor(
    private readonly clinical: ClinicalService,
    private readonly prescriptions: PrescriptionsService,
    private readonly orders: OrdersService,
    private readonly referrals: ReferralsService,
    private readonly carePlans: CarePlansService,
  ) {}

  async chart(access: AccessContext, patientId: string) {
    // clinical.chart checks the patient is in the member's scope before anything is read.
    const core = await this.clinical.chart(access, patientId)
    const [prescriptions, orders, referrals, carePlans] = await Promise.all([
      this.prescriptions.forPatient(access.orgId, patientId),
      this.orders.forPatient(access.orgId, patientId),
      this.referrals.forPatient(access.orgId, patientId),
      this.carePlans.forPatient(access.orgId, patientId),
    ])
    return { ...core, prescriptions, orders, referrals, carePlans }
  }
}
