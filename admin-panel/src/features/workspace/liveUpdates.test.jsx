import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../config/routes'
import { billingFake } from '../../test/fixtures/billingFake'
import { createWorkspaceApi } from '../../test/fixtures/workspaceApi'
import { renderRoute } from '../../test/renderRoute'

// A stand-in for the browser's EventSource that the test drives by hand.
function fakeStream() {
  const handlers = new Map()
  const source = {
    closed: false,
    addEventListener: (type, handler) => handlers.set(type, handler),
    close: () => {
      source.closed = true
    },
  }
  return { source, send: (type) => act(() => handlers.get(type)?.({ data: '{"id":"x"}' })) }
}

const NOTICE = { id: 'n-1', title: 'New booking from the patient app', body: 'Asha Rao, Tue, 1 Dec 2026 at 9:30 am.', entityType: 'appointment', entityId: 'a-1', patientId: 'p-1', readAt: null }

const calls = (fake, name) => fake.calls.filter((call) => call.name === name).length

describe('live updates in the workspace', () => {
  it('reloads the dashboard when a booking changes, once however many events arrive together', async () => {
    const stream = fakeStream()
    billingFake.useWorkspace(createWorkspaceApi({ stream: () => stream.source }))
    renderRoute(ROUTES.dashboard)
    await screen.findByText('22 scheduled')
    stream.send('ready')
    const before = billingFake.dashboard.calls.length

    stream.send('appointments')
    stream.send('appointments')
    stream.send('notifications')
    await waitFor(() => expect(billingFake.dashboard.calls.length).toBe(before + 1))
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(billingFake.dashboard.calls.length).toBe(before + 1)
  })

  it('reloads after the connection comes back, but not for the first connection', async () => {
    const stream = fakeStream()
    const workspace = createWorkspaceApi({ stream: () => stream.source })
    billingFake.useWorkspace(workspace)
    renderRoute(ROUTES.dashboard)
    await screen.findByText('22 scheduled')
    const before = billingFake.dashboard.calls.length

    stream.send('ready')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(billingFake.dashboard.calls.length).toBe(before)
    stream.send('ready')
    await waitFor(() => expect(billingFake.dashboard.calls.length).toBe(before + 1))
  })

  it('shows booking notices in the alerts, counts them and marks them read on closing', async () => {
    const user = userEvent.setup({ delay: null })
    const workspace = createWorkspaceApi({ notices: [NOTICE], alerts: () => ({ items: [], branchId: null }) })
    billingFake.useWorkspace(workspace)
    renderRoute(ROUTES.dashboard)

    await user.click(await screen.findByRole('button', { name: 'Alerts (1 unread)' }))
    const activity = within(screen.getByRole('region', { name: 'Alerts' })).getByRole('list', { name: 'Recent activity' })
    expect(within(activity).getByRole('link', { name: /New booking from the patient app/ })).toHaveAttribute('href', '/patients/p-1/appointment/a-1')
    expect(calls(workspace, 'markNotificationsRead')).toBe(0)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Alerts' })).toBeInTheDocument())
    expect(calls(workspace, 'markNotificationsRead')).toBe(1)
  })
})
