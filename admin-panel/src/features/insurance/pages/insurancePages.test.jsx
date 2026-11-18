import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })

async function chooseAcceptance(user) {
  await user.click(screen.getByRole('radio', { name: /Yes, accept insurance/ }))
  await user.click(screen.getByRole('checkbox', { name: 'Cashless billing' }))
  await user.click(screen.getByRole('checkbox', { name: /HDFC ERGO General Insurance/ }))
  await user.click(screen.getByRole('checkbox', { name: /Medi Assist Insurance TPA/ }))
  await user.click(screen.getByRole('button', { name: /Continue to agreement details/ }))
}

describe('insurance setup', () => {
  it('requires an answer, then a billing method and a partner', async () => {
    const user = setup()
    renderRoute(ROUTES.insurance)

    await user.click(screen.getByRole('button', { name: /Continue to agreement details/ }))
    expect(screen.getByText('Choose whether your clinic accepts insurance.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Yes, accept insurance/ }))
    expect(screen.getByText('Choose cashless billing, reimbursement support or both.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one insurer or TPA.')).toBeInTheDocument()
  })

  it('returns to the workspace when insurance is declined', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.insurance)

    await user.click(screen.getByRole('radio', { name: /Not at the moment/ }))
    await user.click(screen.getByRole('button', { name: /Save and return to workspace/ }))
    expect(router.state.location.pathname).toBe(ROUTES.dashboard)
  })

  it('filters partners and adds an unlisted one', async () => {
    const user = setup()
    renderRoute(ROUTES.insurance)

    await user.click(screen.getByRole('radio', { name: /Yes, accept insurance/ }))
    await user.type(screen.getByLabelText('Search insurer or TPA'), 'star')
    expect(screen.queryByRole('checkbox', { name: /HDFC ERGO/ })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Search insurer or TPA'))
    await user.click(screen.getByRole('button', { name: '+ Add an unlisted partner' }))
    await user.type(screen.getByLabelText(/Partner name/), 'Care Health Insurance')
    await user.selectOptions(screen.getByLabelText(/Partner type/), 'Insurer')
    await user.click(screen.getByRole('button', { name: 'Add partner' }))
    expect(screen.getByRole('checkbox', { name: /Care Health Insurance/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('sends a direct visit to the agreement step back to step 1', () => {
    const router = renderRoute(ROUTES.insuranceAgreement)
    expect(router.state.location.pathname).toBe(ROUTES.insurance)
  })

  it('walks through agreement details to the review summary', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.insurance)
    await chooseAcceptance(user)
    expect(router.state.location.pathname).toBe(ROUTES.insuranceAgreement)

    await user.click(screen.getByRole('button', { name: /Review insurance setup/ }))
    expect(screen.getByText('Choose the insurer for this agreement.')).toBeInTheDocument()
    expect(screen.getByText('Choose at least one branch.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Insurer/), 'HDFC ERGO General Insurance')
    await user.selectOptions(screen.getByLabelText(/Servicing TPA/), 'Medi Assist Insurance TPA')
    await user.type(screen.getByLabelText(/Agreement reference/), 'AGR-BLR-001')
    await user.type(screen.getByLabelText(/Proposed start date/), '2026-12-01')
    await user.type(screen.getByLabelText(/Proposed end date/), '2026-11-30')
    await user.click(screen.getByRole('checkbox', { name: /Bangalore Central/ }))
    await user.click(screen.getByRole('checkbox', { name: 'OPD consultations' }))
    await user.click(screen.getByRole('button', { name: /Review insurance setup/ }))
    expect(screen.getByText('End date must be after the start date.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Proposed end date/))
    await user.type(screen.getByLabelText(/Proposed end date/), '2027-11-30')
    await user.click(screen.getByRole('button', { name: /Review insurance setup/ }))

    expect(router.state.location.pathname).toBe(ROUTES.insuranceReview)
    const agreement = screen.getByRole('region', { name: 'Partner & agreement' })
    expect(within(agreement).getByText('01 Dec 2026 – 30 Nov 2027')).toBeInTheDocument()
    expect(within(agreement).getByText('Medi Assist Insurance TPA')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Branch & service coverage' })).getByText('Whitefield · Diagnostics · Day care')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Edit partner & agreement' }))
    expect(screen.getByLabelText(/Agreement reference/)).toHaveValue('AGR-BLR-001')
  })

  it('rejects an agreement file that is not a PDF', async () => {
    const user = userEvent.setup({ delay: null, applyAccept: false })
    renderRoute(ROUTES.insurance)
    await chooseAcceptance(user)

    await user.upload(screen.getByLabelText(/Agreement document/), new File(['x'], 'scan.png', { type: 'image/png' }))
    expect(screen.getByText('Upload the agreement as a PDF.')).toBeInTheDocument()

    await user.upload(screen.getByLabelText(/Agreement document/), new File(['%PDF'], 'agreement.pdf', { type: 'application/pdf' }))
    expect(screen.getByText(/Attached: agreement.pdf/)).toBeInTheDocument()
  })
})
