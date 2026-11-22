import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { createBillingApi } from './fixtures/billingApi'
import { createCampaignsApi } from './fixtures/campaignsApi'
import { createContentApi } from './fixtures/contentApi'
import { billingFake } from './fixtures/billingFake'
import { createDashboardApi } from './fixtures/dashboardApi'
import { createInventoryApi } from './fixtures/inventoryApi'
import { createLeadsApi } from './fixtures/leadsApi'
import { createMessagingApi } from './fixtures/messagingApi'
import { createPayrollApi } from './fixtures/payrollApi'
import { createReportsApi } from './fixtures/reportsApi'
import { createWorkspaceApi } from './fixtures/workspaceApi'

// The suite renders whole pages in parallel workers; under full load a first API-backed render can take several
// seconds, so async queries wait up to 15s (they still return as soon as the element appears).
configure({ asyncUtilTimeout: 15000 })

// Every test talks to in-memory billing, inventory and payroll APIs (test/fixtures/billingApi.js, inventoryApi.js,
// payrollApi.js), fresh for each test. A test that needs different records replaces one with billingFake.use /
// billingFake.useInventory / billingFake.usePayroll.
vi.mock('../features/billing/api', () => ({
  billingApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.current.api[method](...args) }),
}))

vi.mock('../features/inventory/api', () => ({
  inventoryApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.inventory.api[method](...args) }),
}))

vi.mock('../features/reports/api', () => ({
  reportsApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.reports.api[method](...args) }),
}))

vi.mock('../features/dashboard/api', () => ({
  dashboardApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.dashboard.api[method](...args) }),
}))

vi.mock('../features/workspace/api', () => ({
  workspaceApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.workspace.api[method](...args) }),
}))

vi.mock('../features/growth/leadsApi', () => ({
  leadsApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.leads.api[method](...args) }),
}))

vi.mock('../features/growth/messagingApi', () => ({
  messagingApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.messaging.api[method](...args) }),
}))

vi.mock('../features/growth/campaignsApi', () => ({
  campaignsApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.campaigns.api[method](...args) }),
}))

vi.mock('../features/growth/contentApi', () => ({
  contentApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.content.api[method](...args) }),
}))

vi.mock('../features/payroll/api', () => ({
  payrollApi: new Proxy({}, { get: (_, method) => (...args) => billingFake.payroll.api[method](...args) }),
}))

beforeEach(() => {
  billingFake.use(createBillingApi())
  billingFake.useInventory(createInventoryApi())
  billingFake.usePayroll(createPayrollApi())
  billingFake.useReports(createReportsApi())
  billingFake.useDashboard(createDashboardApi())
  billingFake.useWorkspace(createWorkspaceApi())
  billingFake.useLeads(createLeadsApi())
  billingFake.useMessaging(createMessagingApi())
  billingFake.useCampaigns(createCampaignsApi())
  billingFake.useContent(createContentApi())
  localStorage.clear()
})

afterEach(cleanup)
