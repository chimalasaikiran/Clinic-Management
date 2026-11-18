// The billing API fake the current test talks to (see test/setup.js). `use` swaps it, for tests that need
// different records; `current.calls` and `current.state` show what the screens sent.
export const billingFake = {
  current: null,
  use(fake) {
    this.current = fake
    return fake
  },
}
