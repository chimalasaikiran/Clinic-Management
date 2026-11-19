// The API fakes the current test talks to (see test/setup.js): `use` swaps the billing fake, `useInventory` the
// inventory and pharmacy one, `usePayroll` the payroll one, for tests that need different records. Each fake's `calls` and `state` show what
// the screens sent.
export const billingFake = {
  current: null,
  inventory: null,
  payroll: null,
  reports: null,
  dashboard: null,
  workspace: null,
  leads: null,
  messaging: null,
  use(fake) {
    this.current = fake
    return fake
  },
  useInventory(fake) {
    this.inventory = fake
    return fake
  },
  usePayroll(fake) {
    this.payroll = fake
    return fake
  },
  useReports(fake) {
    this.reports = fake
    return fake
  },
  useDashboard(fake) {
    this.dashboard = fake
    return fake
  },
  useWorkspace(fake) {
    this.workspace = fake
    return fake
  },
  useLeads(fake) {
    this.leads = fake
    return fake
  },
  useMessaging(fake) {
    this.messaging = fake
    return fake
  },
}
