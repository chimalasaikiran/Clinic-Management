// The API fakes the current test talks to (see test/setup.js): `use` swaps the billing fake, `useInventory` the
// inventory and pharmacy one, `usePayroll` the payroll one, for tests that need different records. Each fake's `calls` and `state` show what
// the screens sent.
export const billingFake = {
  current: null,
  inventory: null,
  payroll: null,
  reports: null,
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
}
