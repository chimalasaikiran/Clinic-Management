import { createBrowserRouter, Outlet } from 'react-router-dom'
import { ROUTES } from '../config/routes'
import StaffDirectoryPage from '../features/staff/pages/StaffDirectoryPage'
import AddPersonPage from '../features/staff/pages/AddPersonPage'
import AssignBranchesPage from '../features/staff/pages/AssignBranchesPage'
import UserAccountPage from '../features/staff/pages/UserAccountPage'
import StaffMemberPage from '../features/staff/pages/StaffProfilePage'
import OpdSchedulePage from '../features/staff/pages/OpdSchedulePage'
import LeaveAvailabilityPage from '../features/staff/pages/LeaveAvailabilityPage'
import AttendancePage from '../features/staff/pages/AttendancePage'
import PatientRecordsProvider from '../features/patients/context/PatientRecordsProvider'
import PatientHubLayout from '../features/patients/components/PatientHubLayout'
import PatientDirectoryPage from '../features/patients/pages/PatientDirectoryPage'
import RegisterPatientPage from '../features/patients/pages/RegisterPatientPage'
import OverviewTab from '../features/patients/pages/OverviewTab'
import AppointmentsTab from '../features/patients/pages/AppointmentsTab'
import EncountersTab from '../features/patients/pages/EncountersTab'
import RecordsTab from '../features/patients/pages/RecordsTab'
import PrescriptionsTab from '../features/patients/pages/PrescriptionsTab'
import OrdersTab from '../features/patients/pages/OrdersTab'
import ReferralsTab from '../features/patients/pages/ReferralsTab'
import BillingTab from '../features/patients/pages/BillingTab'
import FamilyTab from '../features/patients/pages/FamilyTab'
import CommunicationTab from '../features/patients/pages/CommunicationTab'
import EncounterPage from '../features/patients/pages/EncounterPage'
import EncounterDiagnosesPage from '../features/patients/pages/EncounterDiagnosesPage'
import AppointmentDetailPage from '../features/patients/pages/AppointmentDetailPage'
import BookAppointmentPage from '../features/patients/pages/BookAppointmentPage'
import RescheduleAppointmentPage from '../features/patients/pages/RescheduleAppointmentPage'
import CancelAppointmentPage from '../features/patients/pages/CancelAppointmentPage'
import NoShowPage from '../features/patients/pages/NoShowPage'
import CheckInPage from '../features/patients/pages/CheckInPage'
import StartEncounterPage from '../features/patients/pages/StartEncounterPage'
import StockProvider from '../features/inventory/context/StockProvider'
import InventoryLayout from '../features/inventory/components/InventoryLayout'
import StockOnHandTab from '../features/inventory/pages/StockOnHandTab'
import RequestsTab from '../features/inventory/pages/RequestsTab'
import PurchaseOrdersTab from '../features/inventory/pages/PurchaseOrdersTab'
import ReceivingTab from '../features/inventory/pages/ReceivingTab'
import TransfersTab from '../features/inventory/pages/TransfersTab'
import AdjustmentsTab from '../features/inventory/pages/AdjustmentsTab'
import InventorySetupPage from '../features/inventory/pages/InventorySetupPage'
import ItemDetailPage from '../features/inventory/pages/ItemDetailPage'
import ItemFormPage from '../features/inventory/pages/ItemFormPage'
import StockRequestReviewPage from '../features/inventory/pages/StockRequestReviewPage'
import PurchaseOrderPage from '../features/inventory/pages/PurchaseOrderPage'
import CreatePurchaseOrderPage from '../features/inventory/pages/CreatePurchaseOrderPage'
import ReceiveStockPage from '../features/inventory/pages/ReceiveStockPage'
import ReceiptReconciliationPage from '../features/inventory/pages/ReceiptReconciliationPage'
import StockTransfersPage from '../features/inventory/pages/StockTransfersPage'
import NewTransferPage from '../features/inventory/pages/NewTransferPage'
import SuppliersPage from '../features/inventory/pages/SuppliersPage'
import SupplierDetailPage from '../features/inventory/pages/SupplierDetailPage'
import SupplierFormPage from '../features/inventory/pages/SupplierFormPage'
import PharmacyPage from '../features/pharmacy/pages/PharmacyPage'
import PrescriptionQueuePage from '../features/pharmacy/pages/PrescriptionQueuePage'
import PharmacyRequestsPage from '../features/pharmacy/pages/PharmacyRequestsPage'
import NewStockRequestPage from '../features/pharmacy/pages/NewStockRequestPage'
import ReturnsPage from '../features/pharmacy/pages/ReturnsPage'
import NewReturnPage from '../features/pharmacy/pages/NewReturnPage'
import ReturnDetailPage from '../features/pharmacy/pages/ReturnDetailPage'
import AppointmentsSchedulePage from '../features/appointments/pages/AppointmentsSchedulePage'
import ClinicalHubPage from '../features/clinical/pages/ClinicalHubPage'
import CreateCarePlanPage from '../features/clinical/pages/CreateCarePlanPage'
import ReportIncidentPage from '../features/clinical/pages/ReportIncidentPage'
import BillingProvider from '../features/billing/context/BillingProvider'
import BillingHubPage from '../features/billing/pages/BillingHubPage'
import InvoiceRegisterPage from '../features/billing/pages/InvoiceRegisterPage'
import InvoiceDetailPage from '../features/billing/pages/InvoiceDetailPage'
import CreateInvoicePage from '../features/billing/pages/CreateInvoicePage'
import ServicesPricingPage from '../features/billing/pages/ServicesPricingPage'
import BillingServiceDetailPage from '../features/billing/pages/BillingServiceDetailPage'
import ServiceFormPage from '../features/billing/pages/ServiceFormPage'
import BillingConfigPage from '../features/billing/pages/BillingConfigPage'
import ChargeRegisterPage from '../features/billing/pages/ChargeRegisterPage'
import ChargeFormPage from '../features/billing/pages/ChargeFormPage'
import PaymentRegisterPage from '../features/billing/pages/PaymentRegisterPage'
import RecordPaymentPage from '../features/billing/pages/RecordPaymentPage'
import PaymentDetailPage from '../features/billing/pages/PaymentDetailPage'
import PaymentAllocationPage from '../features/billing/pages/PaymentAllocationPage'
import ReceiptRegisterPage from '../features/billing/pages/ReceiptRegisterPage'
import ReceiptDetailPage from '../features/billing/pages/ReceiptDetailPage'
import RefundRegisterPage from '../features/billing/pages/RefundRegisterPage'
import RefundFormPage from '../features/billing/pages/RefundFormPage'
import RefundDetailPage from '../features/billing/pages/RefundDetailPage'
import ReconciliationPage from '../features/billing/pages/ReconciliationPage'
import ExceptionDetailPage from '../features/billing/pages/ExceptionDetailPage'
import BalancesPage from '../features/billing/pages/BalancesPage'
import SettlementsPage from '../features/billing/pages/SettlementsPage'
import FinanceReportsPage from '../features/billing/pages/FinanceReportsPage'
import CreateAccountPage from '../features/auth/pages/CreateAccountPage'
import SignInPage from '../features/auth/pages/SignInPage'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage'
import ResetPasswordPage from '../features/auth/pages/ResetPasswordPage'
import AcceptInvitationPage from '../features/auth/pages/AcceptInvitationPage'
import { RequireAccount, RequireGuest, RequireWorkspace, RootRedirect } from '../features/auth/components/RouteGuards'
import VerifyAccountPage from '../features/auth/pages/VerifyAccountPage'
import BranchAccessPage from '../features/configuration/pages/BranchAccessPage'
import BranchInventoryPage from '../features/configuration/pages/BranchInventoryPage'
import DepartmentsPage from '../features/configuration/pages/DepartmentsPage'
import DepartmentDetailPage from '../features/configuration/pages/DepartmentDetailPage'
import CreateDepartmentPage from '../features/configuration/pages/CreateDepartmentPage'
import DepartmentStaffPage from '../features/configuration/pages/DepartmentStaffPage'
import DepartmentLocationsPage from '../features/configuration/pages/DepartmentLocationsPage'
import DepartmentAccessPage from '../features/configuration/pages/DepartmentAccessPage'
import RolesProvider from '../features/role-management/context/RolesProvider'
import RolesPage from '../features/role-management/pages/RolesPage'
import CreateRolePage from '../features/role-management/pages/CreateRolePage'
import PayrollProvider from '../features/payroll/context/PayrollProvider'
import RunPayrollLayout from '../features/payroll/components/RunPayrollLayout'
import PayrollOverviewPage from '../features/payroll/pages/PayrollOverviewPage'
import CycleHistoryPage from '../features/payroll/pages/CycleHistoryPage'
import BranchLedgerPage from '../features/payroll/pages/BranchLedgerPage'
import PayrollSetupPage from '../features/payroll/pages/PayrollSetupPage'
import PeriodStep from '../features/payroll/pages/run/PeriodStep'
import StaffStep from '../features/payroll/pages/run/StaffStep'
import CalculationsStep from '../features/payroll/pages/run/CalculationsStep'
import AdjustmentsStep from '../features/payroll/pages/run/AdjustmentsStep'
import AddAdjustmentPage from '../features/payroll/pages/run/AddAdjustmentPage'
import AdvancesStep from '../features/payroll/pages/run/AdvancesStep'
import CreateAdvancePage from '../features/payroll/pages/run/CreateAdvancePage'
import ReviewAdvancePage from '../features/payroll/pages/run/ReviewAdvancePage'
import FinalReviewStep from '../features/payroll/pages/run/FinalReviewStep'
import ProcessStep from '../features/payroll/pages/run/ProcessStep'
import ServicesPage from '../features/configuration/pages/ServicesPage'
import ServiceDetailPage from '../features/configuration/pages/ServiceDetailPage'
import AddServicePage from '../features/configuration/pages/AddServicePage'
import BranchDetailPage from '../features/configuration/pages/BranchDetailPage'
import BranchStaffPage from '../features/configuration/pages/BranchStaffPage'
import CreateBranchPage from '../features/configuration/pages/CreateBranchPage'
import OperatingHoursPage from '../features/configuration/pages/OperatingHoursPage'
import OrganisationPage from '../features/configuration/pages/OrganisationPage'
import StaffProfilePage from '../features/configuration/pages/StaffProfilePage'
import DashboardPage from '../features/dashboard/pages/DashboardPage'
import GrowthProvider from '../features/growth/context/GrowthProvider'
import GrowthHomePage from '../features/growth/pages/GrowthHomePage'
import LeadRegisterPage from '../features/growth/pages/LeadRegisterPage'
import LeadFormPage from '../features/growth/pages/LeadFormPage'
import LeadDetailPage from '../features/growth/pages/LeadDetailPage'
import LeadFollowUpPage from '../features/growth/pages/LeadFollowUpPage'
import LeadConversionPage from '../features/growth/pages/LeadConversionPage'
import CampaignRegisterPage from '../features/growth/pages/CampaignRegisterPage'
import CampaignFormPage from '../features/growth/pages/CampaignFormPage'
import CampaignDetailPage from '../features/growth/pages/CampaignDetailPage'
import CampaignAttributionPage from '../features/growth/pages/CampaignAttributionPage'
import AudiencePage from '../features/growth/pages/AudiencePage'
import SegmentFormPage from '../features/growth/pages/SegmentFormPage'
import ContentCalendarPage from '../features/growth/pages/ContentCalendarPage'
import ContentFormPage from '../features/growth/pages/ContentFormPage'
import ContentTemplatesPage from '../features/growth/pages/ContentTemplatesPage'
import SchedulePublishPage from '../features/growth/pages/SchedulePublishPage'
import BusinessProfilePage from '../features/growth/pages/BusinessProfilePage'
import ReviewsRegisterPage from '../features/growth/pages/ReviewsRegisterPage'
import ReviewRequestPage from '../features/growth/pages/ReviewRequestPage'
import ReviewDetailPage from '../features/growth/pages/ReviewDetailPage'
import FeedbackEscalationPage from '../features/growth/pages/FeedbackEscalationPage'
import ReputationReportPage from '../features/growth/pages/ReputationReportPage'
import ConversationsInboxPage from '../features/growth/pages/ConversationsInboxPage'
import ConversationThreadPage from '../features/growth/pages/ConversationThreadPage'
import CommunicationHistoryPage from '../features/growth/pages/CommunicationHistoryPage'
import MessageTemplatesPage from '../features/growth/pages/MessageTemplatesPage'
import ChannelConfigPage from '../features/growth/pages/ChannelConfigPage'
import DeliveryFailuresPage from '../features/growth/pages/DeliveryFailuresPage'
import RetentionWorkflowsPage from '../features/growth/pages/RetentionWorkflowsPage'
import WorkflowFormPage from '../features/growth/pages/WorkflowFormPage'
import WorkflowExecutionsPage from '../features/growth/pages/WorkflowExecutionsPage'
import GrowthPerformancePage from '../features/growth/pages/GrowthPerformancePage'
import ReportsOverviewPage from '../features/reports/pages/ReportsOverviewPage'
import OperationsReportPage from '../features/reports/pages/OperationsReportPage'
import FinancialReportPage from '../features/reports/pages/FinancialReportPage'
import PharmacyReportPage from '../features/reports/pages/PharmacyReportPage'
import ClinicalSpecialtiesPage from '../features/onboarding/pages/ClinicalSpecialtiesPage'
import ClinicProfilePage from '../features/onboarding/pages/ClinicProfilePage'
import OperationalInfoPage from '../features/onboarding/pages/OperationalInfoPage'
import PracticeContactPage from '../features/onboarding/pages/PracticeContactPage'
import SetupCompletePage from '../features/onboarding/pages/SetupCompletePage'
import SetupIntroPage from '../features/onboarding/pages/SetupIntroPage'
import InsuranceSetupProvider from '../features/insurance/context/InsuranceSetupProvider'
import AcceptancePage from '../features/insurance/pages/AcceptancePage'
import AgreementPage from '../features/insurance/pages/AgreementPage'
import ReviewPage from '../features/insurance/pages/ReviewPage'

export const routes = [
  {
    element: <Outlet />,
    children: [
      { path: ROUTES.root, element: <RootRedirect /> },

      {
        element: <RequireGuest />,
        children: [
          { path: ROUTES.signin, element: <SignInPage /> },
          { path: ROUTES.signup, element: <CreateAccountPage /> },
        ],
      },
      { path: ROUTES.verify, element: <VerifyAccountPage /> },
      { path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
      { path: ROUTES.resetPassword, element: <ResetPasswordPage /> },
      { path: ROUTES.invite, element: <AcceptInvitationPage /> },

      { path: ROUTES.setup, element: <SetupIntroPage /> },
      {
        element: <RequireAccount />,
        children: [
          { path: ROUTES.clinic, element: <ClinicProfilePage /> },
          { path: ROUTES.contact, element: <PracticeContactPage /> },
          { path: ROUTES.operations, element: <OperationalInfoPage /> },
          { path: ROUTES.specialties, element: <ClinicalSpecialtiesPage /> },
          { path: ROUTES.complete, element: <SetupCompletePage /> },

          {
            element: <InsuranceSetupProvider />,
            children: [
              { path: ROUTES.insurance, element: <AcceptancePage /> },
              { path: ROUTES.insuranceAgreement, element: <AgreementPage /> },
              { path: ROUTES.insuranceReview, element: <ReviewPage /> },
            ],
          },
        ],
      },

      {
        element: <RequireWorkspace />,
        children: [
          { path: ROUTES.dashboard, element: <DashboardPage /> },

          {
            element: <PatientRecordsProvider />,
            children: [
              {
                element: <BillingProvider />,
                children: [
                  { path: ROUTES.billing, element: <BillingHubPage /> },
                  { path: ROUTES.billingInvoices, element: <InvoiceRegisterPage /> },
                  { path: ROUTES.billingInvoiceNew, element: <CreateInvoicePage /> },
                  { path: ROUTES.billingInvoice, element: <InvoiceDetailPage /> },
                  { path: ROUTES.billingServices, element: <ServicesPricingPage /> },
                  { path: ROUTES.billingServiceNew, element: <ServiceFormPage /> },
                  { path: ROUTES.billingService, element: <BillingServiceDetailPage /> },
                  { path: ROUTES.billingServiceEdit, element: <ServiceFormPage /> },
                  { path: ROUTES.billingConfig, element: <BillingConfigPage /> },
                  { path: ROUTES.billingCharges, element: <ChargeRegisterPage /> },
                  { path: ROUTES.billingChargeNew, element: <ChargeFormPage /> },
                  { path: ROUTES.billingCharge, element: <ChargeFormPage /> },
                  { path: ROUTES.billingPayments, element: <PaymentRegisterPage /> },
                  { path: ROUTES.billingPaymentNew, element: <RecordPaymentPage /> },
                  { path: ROUTES.billingPayment, element: <PaymentDetailPage /> },
                  { path: ROUTES.billingAllocation, element: <PaymentAllocationPage /> },
                  { path: ROUTES.billingReceipts, element: <ReceiptRegisterPage /> },
                  { path: ROUTES.billingReceipt, element: <ReceiptDetailPage /> },
                  { path: ROUTES.billingRefunds, element: <RefundRegisterPage /> },
                  { path: ROUTES.billingRefundNew, element: <RefundFormPage /> },
                  { path: ROUTES.billingRefund, element: <RefundDetailPage /> },
                  { path: ROUTES.billingReconciliation, element: <ReconciliationPage /> },
                  { path: ROUTES.billingException, element: <ExceptionDetailPage /> },
                  { path: ROUTES.billingBalances, element: <BalancesPage /> },
                  { path: ROUTES.billingSettlements, element: <SettlementsPage /> },
                  { path: ROUTES.billingReports, element: <FinanceReportsPage /> },
                  { path: ROUTES.reports, element: <ReportsOverviewPage /> },
                  { path: ROUTES.reportsOperations, element: <OperationsReportPage /> },
                  { path: ROUTES.reportsFinancial, element: <FinancialReportPage /> },
                  { path: ROUTES.reportsPharmacy, element: <PharmacyReportPage /> },
                ],
              },
              { path: ROUTES.appointments, element: <AppointmentsSchedulePage /> },
              { path: ROUTES.clinical, element: <ClinicalHubPage /> },
              { path: ROUTES.incidentNew, element: <ReportIncidentPage /> },
              { path: ROUTES.patientCarePlanNew, element: <CreateCarePlanPage /> },
              { path: ROUTES.patients, element: <PatientDirectoryPage /> },
              { path: ROUTES.patientNew, element: <RegisterPatientPage /> },
              { path: ROUTES.patientEdit, element: <RegisterPatientPage /> },
              { path: ROUTES.appointmentNew, element: <BookAppointmentPage /> },
              { path: ROUTES.appointment, element: <AppointmentDetailPage /> },
              { path: ROUTES.appointmentReschedule, element: <RescheduleAppointmentPage /> },
              { path: ROUTES.appointmentCancel, element: <CancelAppointmentPage /> },
              { path: ROUTES.appointmentNoShow, element: <NoShowPage /> },
              { path: ROUTES.appointmentCheckIn, element: <CheckInPage /> },
              { path: ROUTES.appointmentStartEncounter, element: <StartEncounterPage /> },
              { path: ROUTES.encounter, element: <EncounterPage /> },
              { path: ROUTES.encounterDiagnoses, element: <EncounterDiagnosesPage /> },
              {
                path: ROUTES.patientHub,
                element: <PatientHubLayout />,
                children: [
                  { index: true, element: <OverviewTab /> },
                  { path: 'appointments', element: <AppointmentsTab /> },
                  { path: 'encounters', element: <EncountersTab /> },
                  { path: 'records', element: <RecordsTab /> },
                  { path: 'prescriptions', element: <PrescriptionsTab /> },
                  { path: 'orders', element: <OrdersTab /> },
                  { path: 'referrals', element: <ReferralsTab /> },
                  { path: 'billing', element: <BillingTab /> },
                  { path: 'family', element: <FamilyTab /> },
                  { path: 'communication', element: <CommunicationTab /> },
                ],
              },
            ],
          },

          {
            element: <StockProvider />,
            children: [
              {
                path: ROUTES.inventory,
                element: <InventoryLayout />,
                children: [
                  { index: true, element: <StockOnHandTab /> },
                  { path: 'requests', element: <RequestsTab /> },
                  { path: 'purchase-orders', element: <PurchaseOrdersTab /> },
                  { path: 'receiving', element: <ReceivingTab /> },
                  { path: 'transfers', element: <TransfersTab /> },
                  { path: 'adjustments', element: <AdjustmentsTab /> },
                ],
              },
              { path: ROUTES.inventorySetup, element: <InventorySetupPage /> },
              { path: ROUTES.inventoryItemNew, element: <ItemFormPage /> },
              { path: ROUTES.inventoryItem, element: <ItemDetailPage /> },
              { path: ROUTES.inventoryItemEdit, element: <ItemFormPage /> },
              { path: ROUTES.inventoryRequest, element: <StockRequestReviewPage /> },
              { path: ROUTES.inventoryOrderNew, element: <CreatePurchaseOrderPage /> },
              { path: ROUTES.inventoryOrder, element: <PurchaseOrderPage /> },
              { path: ROUTES.inventoryReceiveNew, element: <ReceiveStockPage /> },
              { path: ROUTES.inventoryReceipt, element: <ReceiptReconciliationPage /> },
              { path: ROUTES.stockTransfers, element: <StockTransfersPage /> },
              { path: ROUTES.stockTransferNew, element: <NewTransferPage /> },
              { path: ROUTES.pharmacy, element: <PharmacyPage /> },
              { path: ROUTES.pharmacyQueue, element: <PrescriptionQueuePage /> },
              { path: ROUTES.pharmacyRequests, element: <PharmacyRequestsPage /> },
              { path: ROUTES.pharmacyRequestNew, element: <NewStockRequestPage /> },
              { path: ROUTES.pharmacyReturns, element: <ReturnsPage /> },
              { path: ROUTES.pharmacyReturnNew, element: <NewReturnPage /> },
              { path: ROUTES.pharmacyReturn, element: <ReturnDetailPage /> },
              { path: ROUTES.suppliers, element: <SuppliersPage /> },
              { path: ROUTES.supplierNew, element: <SupplierFormPage /> },
              { path: ROUTES.supplier, element: <SupplierDetailPage /> },
              { path: ROUTES.supplierEdit, element: <SupplierFormPage /> },
            ],
          },

          {
            element: <GrowthProvider />,
            children: [
              { path: ROUTES.growth, element: <GrowthHomePage /> },
              { path: ROUTES.leads, element: <LeadRegisterPage /> },
              { path: ROUTES.leadNew, element: <LeadFormPage /> },
              { path: ROUTES.lead, element: <LeadDetailPage /> },
              { path: ROUTES.leadEdit, element: <LeadFormPage /> },
              { path: ROUTES.leadFollowUp, element: <LeadFollowUpPage /> },
              { path: ROUTES.leadConvert, element: <LeadConversionPage /> },
              { path: ROUTES.campaigns, element: <CampaignRegisterPage /> },
              { path: ROUTES.campaignNew, element: <CampaignFormPage /> },
              { path: ROUTES.campaign, element: <CampaignDetailPage /> },
              { path: ROUTES.campaignEdit, element: <CampaignFormPage /> },
              { path: ROUTES.campaignAttribution, element: <CampaignAttributionPage /> },
              { path: ROUTES.audiences, element: <AudiencePage /> },
              { path: ROUTES.segmentNew, element: <SegmentFormPage /> },
              { path: ROUTES.segmentEdit, element: <SegmentFormPage /> },
              { path: ROUTES.content, element: <ContentCalendarPage /> },
              { path: ROUTES.contentNew, element: <ContentFormPage /> },
              { path: ROUTES.contentTemplates, element: <ContentTemplatesPage /> },
              { path: ROUTES.contentEdit, element: <ContentFormPage /> },
              { path: ROUTES.contentSchedule, element: <SchedulePublishPage /> },
              { path: ROUTES.businessProfile, element: <BusinessProfilePage /> },
              { path: ROUTES.reviews, element: <ReviewsRegisterPage /> },
              { path: ROUTES.reviewRequests, element: <ReviewRequestPage /> },
              { path: ROUTES.review, element: <ReviewDetailPage /> },
              { path: ROUTES.escalations, element: <FeedbackEscalationPage /> },
              { path: ROUTES.reputation, element: <ReputationReportPage /> },
              { path: ROUTES.conversations, element: <ConversationsInboxPage /> },
              { path: ROUTES.conversation, element: <ConversationThreadPage /> },
              { path: ROUTES.communicationHistory, element: <CommunicationHistoryPage /> },
              { path: ROUTES.messageTemplates, element: <MessageTemplatesPage /> },
              { path: ROUTES.channels, element: <ChannelConfigPage /> },
              { path: ROUTES.deliveryFailures, element: <DeliveryFailuresPage /> },
              { path: ROUTES.workflows, element: <RetentionWorkflowsPage /> },
              { path: ROUTES.workflowNew, element: <WorkflowFormPage /> },
              { path: ROUTES.workflowEdit, element: <WorkflowFormPage /> },
              { path: ROUTES.workflowExecutions, element: <WorkflowExecutionsPage /> },
              { path: ROUTES.growthPerformance, element: <GrowthPerformancePage /> },
            ],
          },

          { path: ROUTES.staffDirectory, element: <StaffDirectoryPage /> },
          { path: ROUTES.staffNew, element: <AddPersonPage /> },
          { path: ROUTES.staffEdit, element: <AddPersonPage /> },
          { path: ROUTES.staffMember, element: <StaffMemberPage /> },
          { path: ROUTES.staffBranches, element: <AssignBranchesPage /> },
          { path: ROUTES.staffAccount, element: <UserAccountPage /> },
          { path: ROUTES.staffSchedule, element: <OpdSchedulePage /> },
          { path: ROUTES.staffLeave, element: <LeaveAvailabilityPage /> },
          { path: ROUTES.staffAttendance, element: <AttendancePage /> },

          { path: ROUTES.organisation, element: <OrganisationPage /> },
          { path: ROUTES.branchNew, element: <CreateBranchPage /> },
          { path: ROUTES.branch, element: <BranchDetailPage /> },
          { path: ROUTES.branchHours, element: <OperatingHoursPage /> },
          { path: ROUTES.branchStaff, element: <BranchStaffPage /> },
          { path: ROUTES.branchAccess, element: <BranchAccessPage /> },
          { path: ROUTES.branchAccessAdd, element: <BranchAccessPage /> },
          { path: ROUTES.branchInventory, element: <BranchInventoryPage /> },
          { path: ROUTES.staffProfile, element: <StaffProfilePage /> },

          { path: ROUTES.departments, element: <DepartmentsPage /> },
          { path: ROUTES.departmentNew, element: <CreateDepartmentPage /> },
          { path: ROUTES.department, element: <DepartmentDetailPage /> },
          { path: ROUTES.departmentStaff, element: <DepartmentStaffPage /> },
          { path: ROUTES.departmentLocations, element: <DepartmentLocationsPage /> },
          { path: ROUTES.departmentAccess, element: <DepartmentAccessPage /> },

          {
            element: <RolesProvider />,
            children: [
              { path: ROUTES.roles, element: <RolesPage /> },
              { path: ROUTES.roleNew, element: <CreateRolePage /> },
            ],
          },

          {
            element: <PayrollProvider />,
            children: [
              { path: ROUTES.payroll, element: <PayrollOverviewPage /> },
              { path: ROUTES.payrollHistory, element: <CycleHistoryPage /> },
              { path: ROUTES.payrollLedger, element: <BranchLedgerPage /> },
              { path: ROUTES.payrollSetup, element: <PayrollSetupPage /> },
              {
                element: <RunPayrollLayout />,
                children: [
                  { path: ROUTES.payrollRun, element: <PeriodStep /> },
                  { path: ROUTES.payrollRunStaff, element: <StaffStep /> },
                  { path: ROUTES.payrollRunCalculations, element: <CalculationsStep /> },
                  { path: ROUTES.payrollRunAdjustments, element: <AdjustmentsStep /> },
                  { path: ROUTES.payrollAdjustmentNew, element: <AddAdjustmentPage /> },
                  { path: ROUTES.payrollRunAdvances, element: <AdvancesStep /> },
                  { path: ROUTES.payrollAdvanceNew, element: <CreateAdvancePage /> },
                  { path: ROUTES.payrollAdvanceReview, element: <ReviewAdvancePage /> },
                  { path: ROUTES.payrollRunReview, element: <FinalReviewStep /> },
                  { path: ROUTES.payrollRunProcess, element: <ProcessStep /> },
                ],
              },
            ],
          },

          { path: ROUTES.services, element: <ServicesPage /> },
          { path: ROUTES.serviceNew, element: <AddServicePage /> },
          { path: ROUTES.service, element: <ServiceDetailPage /> },
        ],
      },

      { path: '*', element: <RootRedirect /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
