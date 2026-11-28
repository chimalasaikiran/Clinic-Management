import { Module } from '@nestjs/common'
import { AdjustmentsService } from './adjustments.service'
import { CyclesService } from './cycles.service'
import { MyPayController } from './my-pay.controller'
import { MyPayService } from './my-pay.service'
import { PayrollCalculator } from './payroll.calculator'
import { PayrollController } from './payroll.controller'
import { PayrollStateService } from './payroll-state.service'
import { PayrollSupport } from './payroll.support'
import { ProfilesService } from './profiles.service'

@Module({
  controllers: [PayrollController, MyPayController],
  providers: [PayrollSupport, PayrollCalculator, ProfilesService, CyclesService, AdjustmentsService, PayrollStateService, MyPayService],
})
export class PayrollModule {}
