import { DynamicModule, Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { CommonModule } from './common/common.module'
import { ErrorFilter } from './common/errors/error.filter'
import { ConfigModule } from './config/config.module'
import { Env } from './config/env'
import { DatabaseModule } from './database/database.module'
import { AppointmentsModule } from './modules/appointments/appointments.module'
import { AuthModule } from './modules/auth/auth.module'
import { BillingModule } from './modules/billing/billing.module'
import { ClinicalModule } from './modules/clinical/clinical.module'
import { SessionGuard } from './modules/auth/session.guard'
import { HealthModule } from './modules/health/health.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { DashboardModule } from './modules/dashboard/dashboard.module'
import { LeadsModule } from './modules/leads/leads.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { MessagingModule } from './modules/messaging/messaging.module'
import { CampaignsModule } from './modules/campaigns/campaigns.module'
import { ConfigurationModule } from './modules/configuration/configuration.module'
import { ContentModule } from './modules/content/content.module'
import { IntegrationsModule } from './modules/integrations/integrations.module'
import { ReviewsModule } from './modules/reviews/reviews.module'
import { SearchModule } from './modules/search/search.module'
import { PayrollModule } from './modules/payroll/payroll.module'
import { ReportsModule } from './modules/reports/reports.module'
import { InvitationsModule } from './modules/invitations/invitations.module'
import { MembersModule } from './modules/members/members.module'
import { OrganisationsModule } from './modules/organisations/organisations.module'
import { PatientAuthModule } from './modules/patient-auth/patient-auth.module'
import { PatientGuard } from './modules/patient-auth/patient.guard'
import { PatientBookingModule } from './modules/patient-booking/patient-booking.module'
import { PatientRecordsModule } from './modules/patient-records/patient-records.module'
import { PatientRequestsModule } from './modules/patient-requests/patient-requests.module'
import { PatientsModule } from './modules/patients/patients.module'
import { AccessGuard } from './modules/permissions/access.guard'
import { PermissionsModule } from './modules/permissions/permissions.module'
import { RolesModule } from './modules/roles/roles.module'
import { SchedulingModule } from './modules/scheduling/scheduling.module'
import { StaffModule } from './modules/staff/staff.module'
import { UsersModule } from './modules/users/users.module'

// Feature modules are added to `imports`. They get authentication and
// organisation access for free from the global guards below, and declare permissions with
// @RequirePermissions / @RequireAnyPermission / @OrgMember.
@Module({})
export class AppModule {
  static register(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.register(env),
        DatabaseModule,
        CommonModule,
        HealthModule,
        UsersModule,
        AuthModule,
        PermissionsModule,
        RolesModule,
        OrganisationsModule,
        MembersModule,
        InvitationsModule,
        SchedulingModule,
        PatientsModule,
        PatientAuthModule,
        NotificationsModule,
        PatientBookingModule,
        PatientRecordsModule,
        PatientRequestsModule,
        AppointmentsModule,
        StaffModule,
        ClinicalModule,
        BillingModule,
        InventoryModule,
        PayrollModule,
        ReportsModule,
        DashboardModule,
        SearchModule,
        LeadsModule,
        MessagingModule,
        CampaignsModule,
        ConfigurationModule,
        IntegrationsModule,
        ContentModule,
        ReviewsModule,
      ],
      providers: [
        // Order matters: authenticate the session first, then check organisation access.
        { provide: APP_GUARD, useExisting: SessionGuard },
        { provide: APP_GUARD, useExisting: AccessGuard },
        { provide: APP_GUARD, useExisting: PatientGuard },
        { provide: APP_FILTER, useClass: ErrorFilter },
      ],
    }
  }
}
