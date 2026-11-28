import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { ApiError } from '../../../lib/api'
import { authState } from '../../../test/auth'
import { renderRoute } from '../../../test/renderRoute'
import { requestsApi } from '../api'

const permissions = new Set()
const as = () => ({ auth: authState({ permissions: [...permissions], roles: [{ id: 'role-1', name: 'Staff' }] }) })

const REFILL = {
  id: 'r-1', status: 'requested', note: 'Running out on Friday.', decisionNote: null, createdAt: '2026-11-27T10:00:00.000Z', decidedAt: null, decidedBy: null, version: 1,
  branch: { id: 'b-1', name: 'Baner Road' },
  patient: { id: 'p-1', fullName: 'Asha Rao', mrn: 'PT-000001', mobile: '9876543210' },
  prescription: { id: 'rx-1', reference: 'RX-000001', status: 'active', prescriberName: 'Dr. Kavya Mehta', indication: 'Fever', issuedAt: '2026-11-20T10:00:00.000Z', approvedRefills: 0, allowedRefills: 1, items: [{ name: 'Paracetamol', strength: '500 mg', dose: '1 Tablet', frequency: 'Thrice daily', durationDays: 5, refills: 1 }] },
}

const TICKET = {
  id: 't-1', reference: 'HLP-000001', category: 'Appointments', subject: 'Wrong time shown', status: 'open', branch: { id: 'b-1', name: 'Baner Road' },
  patient: { id: 'p-1', fullName: 'Asha Rao', mrn: 'PT-000001', mobile: '9876543210' }, createdAt: '2026-11-27T10:00:00.000Z', updatedAt: '2026-11-27T10:00:00.000Z', resolvedAt: null, messageCount: 1, version: 1,
}

const page = (path) => renderRoute(path, undefined, as())

describe('refill queue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    permissions.clear()
    permissions.add('pharmacy.view').add('pharmacy.dispense')
  })

  it('shows waiting requests with the prescription, and approves one', async () => {
    vi.spyOn(requestsApi, 'refills').mockResolvedValue({ data: [REFILL], meta: { total: 1, waiting: 1 } })
    const decide = vi.spyOn(requestsApi, 'decideRefill').mockResolvedValue({ ...REFILL, status: 'approved' })
    page(ROUTES.pharmacyRefills)

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(screen.getByText(/Running out on Friday/)).toBeInTheDocument()
    expect(screen.getByText('1 waiting')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm approval' }))
    expect(decide).toHaveBeenCalledWith('r-1', { decision: 'approve', note: null, version: 1 })
    expect(await screen.findByRole('status')).toHaveTextContent('Approved the refill for Asha Rao.')
  })

  it('shows the server’s reason when a decline has no explanation', async () => {
    vi.spyOn(requestsApi, 'refills').mockResolvedValue({ data: [REFILL], meta: { total: 1, waiting: 1 } })
    vi.spyOn(requestsApi, 'decideRefill').mockRejectedValue(new ApiError(400, 'VALIDATION_FAILED', 'Check the form.', [{ field: 'note', issue: 'Tell the patient why (at least 5 characters). They will see this.' }]))
    page(ROUTES.pharmacyRefills)

    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm decline' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tell the patient why')
  })

  it('offers no decision to someone who can only view', async () => {
    permissions.clear()
    permissions.add('clinical.read')
    vi.spyOn(requestsApi, 'refills').mockResolvedValue({ data: [REFILL], meta: { total: 1, waiting: 1 } })
    page(ROUTES.pharmacyRefills)

    expect(await screen.findByText(/Deciding needs dispensing or prescribing rights/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })
})

describe('help inbox', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    permissions.clear()
    permissions.add('patients.view').add('patients.edit')
  })

  const conversation = { ...TICKET, messages: [{ id: 'm-1', body: 'My appointment shows 9:00.', by: 'patient', author: 'Asha Rao', at: '2026-11-27T10:00:00.000Z' }] }

  it('lists requests, opens one and replies', async () => {
    vi.spyOn(requestsApi, 'tickets').mockResolvedValue({ data: [TICKET], meta: { total: 1, counts: { open: 1, answered: 0, resolved: 0 } } })
    vi.spyOn(requestsApi, 'ticket').mockResolvedValue(conversation)
    const reply = vi.spyOn(requestsApi, 'reply').mockResolvedValue({ ...conversation, status: 'answered' })
    page(ROUTES.helpRequests)

    await userEvent.click(await screen.findByRole('button', { name: /Wrong time shown/ }))
    const thread = await screen.findByRole('list', { name: 'Messages' })
    expect(within(thread).getByText('My appointment shows 9:00.')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Reply to the patient' }), 'It is 9:30, corrected.')
    await userEvent.click(screen.getByRole('button', { name: 'Send and resolve' }))
    await waitFor(() => expect(reply).toHaveBeenCalledWith('t-1', { body: 'It is 9:30, corrected.', resolve: true }))
  })

  it('lets someone who cannot edit patients read but not reply', async () => {
    permissions.delete('patients.edit')
    vi.spyOn(requestsApi, 'tickets').mockResolvedValue({ data: [TICKET], meta: { total: 1, counts: { open: 1, answered: 0, resolved: 0 } } })
    vi.spyOn(requestsApi, 'ticket').mockResolvedValue(conversation)
    page('/patients/help-requests/t-1')

    expect(await screen.findByText('My appointment shows 9:00.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Reply to the patient' })).not.toBeInTheDocument()
    expect(screen.getByText(/Replying needs permission to edit patients/)).toBeInTheDocument()
  })
})
