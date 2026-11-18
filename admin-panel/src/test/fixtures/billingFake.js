// The API fakes the current test talks to (see test/setup.js): `use` swaps the billing fake, `useInventory` the
// inventory and pharmacy one, for tests that need different records. Each fake's `calls` and `state` show what
// the screens sent.
export const billingFake = {
  current: null,
  inventory: null,
  use(fake) {
    this.current = fake
    return fake
  },
  useInventory(fake) {
    this.inventory = fake
    return fake
  },
}
