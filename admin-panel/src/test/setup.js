import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { createBillingApi } from './fixtures/billingApi'
import { billingFake } from './fixtures/billingFake'
import { createInventoryApi } from './fixtures/inventoryApi'

// The suite renders whole pages in parallel workers; under full load a first API-backed render can take several
// seconds, so async queries wait up to 15s (they still return as soon as the element appears).
configure({ asyncUtilTimeout: 15000 })

// Every test talks to in-memory billing and inventory APIs (test/fixtures/billingApi.js, inventoryApi.js), fresh for
// each test. A test that needs different records replaces one with billingFake.use / billingFake.useInventory.
vi.mock('../features/billing/api', () => ({
  billingApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.current.api[method](...args) }),
}))

vi.mock('../features/inventory/api', () => ({
  inventoryApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.inventory.api[method](...args) }),
}))

beforeEach(() => {
  billingFake.use(createBillingApi())
  billingFake.useInventory(createInventoryApi())
  localStorage.clear()
})

afterEach(cleanup)
