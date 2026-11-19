import { dashboardIcons as icons } from '../assets/icons/dashboard'
import { ROUTES } from './routes'

// `to` is the page a nav entry opens; `match` is the path prefix that keeps it highlighted.
export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: icons.navOverview, to: ROUTES.dashboard, match: ROUTES.dashboard },
  { id: 'patients', label: 'Patients', icon: icons.navPatients, to: ROUTES.patients, match: '/patients' },
  { id: 'appointments', label: 'Appointments', icon: icons.navAppointments, to: ROUTES.appointments, match: '/appointments' },
  { id: 'clinical', label: 'Clinical', icon: icons.navClinical, to: ROUTES.clinical, match: '/clinical' },
  { id: 'billing', label: 'Billing & Finance', icon: icons.navBilling, to: ROUTES.billing, match: '/billing' },
  { id: 'pharmacy', label: 'Pharmacy', icon: icons.navPharmacy, to: ROUTES.pharmacy, match: '/pharmacy' },
  { id: 'inventory', label: 'Inventory', icon: icons.navInventory, to: ROUTES.inventory, match: '/inventory' },
  { id: 'staff', label: 'Staff', icon: icons.navStaff, to: ROUTES.staffDirectory, match: '/staff' },
  { id: 'roles', label: 'Role Management', icon: icons.navRoles, to: ROUTES.roles, match: '/roles' },
  { id: 'payroll', label: 'Payroll', icon: icons.navPayroll, to: ROUTES.payroll, match: '/payroll' },
  {
    id: 'growth',
    label: 'Growth',
    icon: icons.navGrowth,
    to: ROUTES.growth,
    match: '/growth',
    children: [
      { label: 'Leads', to: ROUTES.leads, match: '/growth/leads' },
      { label: 'Campaigns', to: ROUTES.campaigns, match: '/growth/campaigns' },
      { label: 'Audiences', to: ROUTES.audiences, match: '/growth/audiences' },
      { label: 'Content', to: ROUTES.content, match: '/growth/content' },
      { label: 'Reviews', to: ROUTES.reviews, match: '/growth/reviews' },
      { label: 'Conversations', to: ROUTES.conversations, match: '/growth/conversations' },
      { label: 'Workflows', to: ROUTES.workflows, match: '/growth/workflows' },
      { label: 'Performance', to: ROUTES.growthPerformance, match: '/growth/performance' },
    ],
  },
  { id: 'reports', label: 'Reports', icon: icons.navReports, to: ROUTES.reports, match: '/reports' },
  {
    id: 'configuration',
    label: 'Configuration',
    icon: icons.navConfiguration,
    to: ROUTES.organisation,
    match: '/configuration',
  },
]
