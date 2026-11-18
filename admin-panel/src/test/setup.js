import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { createBillingApi } from './fixtures/billingApi'
import { billingFake } from './fixtures/billingFake'

// The suite renders whole pages in parallel workers; under full load a first API-backed render can take several
// seconds, so async queries wait up to 15s (they still return as soon as the element appears).
configure({ asyncUtilTimeout: 15000 })

// Every test talks to an in-memory billing API (test/fixtures/billingApi.js), fresh for each test. A test that
// needs different records replaces it with billingFake.use(createBillingApi({ seed })).
vi.mock('../features/billing/api', () => ({
  billingApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.current.api[method](...args) }),
}))

beforeEach(() => {
  billingFake.use(createBillingApi())
})

afterEach(cleanup)
