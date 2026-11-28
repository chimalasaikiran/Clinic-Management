import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { patientsApi } from '../api'
import PatientAppAccess from './PatientAppAccess'

const permissions = new Set()
vi.mock('../../auth/context/useAuth', () => ({ useAuth: () => ({ can: (id) => permissions.has(id) }) }))

const LINK = { id: 'link-1', method: 'mobile_dob', verifiedAt: '2026-11-27T04:00:00.000Z', revokedAt: null, accountName: 'Asha Rao', accountMobile: '9876543210' }

describe('patient app access', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    permissions.clear()
    permissions.add('patients.edit')
  })

  it('issues a code and shows it once, grouped for reading aloud', async () => {
    vi.spyOn(patientsApi, 'appAccess').mockResolvedValue({ links: [], pendingCodeExpiresAt: null })
    const issue = vi.spyOn(patientsApi, 'issueAppCode').mockResolvedValue({ code: 'ABCD2345', expiresAt: '2026-11-28T04:00:00.000Z' })
    render(<PatientAppAccess patientId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: 'Issue connection code' }))
    expect(await screen.findByText('ABCD 2345')).toBeInTheDocument()
    expect(issue).toHaveBeenCalledWith('p1')
  })

  it('removes access only after confirming', async () => {
    vi.spyOn(patientsApi, 'appAccess').mockResolvedValue({ links: [LINK], pendingCodeExpiresAt: null })
    const revoke = vi.spyOn(patientsApi, 'revokeAppLink').mockResolvedValue(null)
    render(<PatientAppAccess patientId="p1" />)

    await userEvent.click(await screen.findByRole('button', { name: 'Remove access' }))
    expect(revoke).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))
    expect(revoke).toHaveBeenCalledWith('p1', 'link-1')
  })

  it('offers no changes to someone who may only view the record', async () => {
    permissions.clear()
    vi.spyOn(patientsApi, 'appAccess').mockResolvedValue({ links: [LINK], pendingCodeExpiresAt: null })
    render(<PatientAppAccess patientId="p1" />)

    expect(await screen.findByText(/Asha Rao/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
