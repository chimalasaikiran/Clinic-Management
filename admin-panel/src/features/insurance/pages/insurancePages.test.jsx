import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { billingFake } from '../../../test/fixtures/billingFake'
import { renderRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })
const acceptRadio = () => screen.findByRole('radio', { name: /Yes, accept insurance/ })

async function chooseAcceptance(user) {
  await user.click(await acceptRadio())
  await user.click(screen.getByRole('checkbox', { name: 'Cashless billing' }))
  await user.click(screen.getByRole('checkbox', { name: /HDFC ERGO General Insurance/ }))
  await user.click(screen.getByRole('checkbox', { name: /Medi Assist Insurance TPA/ }))
  await user.click(screen.getByRole('button', { name: /Continue to agreement details/ }))
}

describe('insurance setup', () => {
  it('requires an answer, then a billing method and a partner', async () => {
    const user = setup()
    renderRoute(ROUTES.insurance)

    await user.click(await screen.findByRole('button', { name: /Continue to agreement details/ }))
    expect(screen.getByText('Choose whether your clinic accepts insurance.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Yes, accept insurance/ }))
    expect(screen.getByText('Choose cashless billing, reimbursement support or both.')).toBeInTheDocument()
    expect(screen.getByText('Select at least one insurer or TPA.')).toBeInTheDocument()
  })

  it('saves a decline and returns to the workspace', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.insurance)

    await user.click(await screen.findByRole('radio', { name: /Not at the moment/ }))
    await user.click(screen.getByRole('button', { name: /Save and return to workspace/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.dashboard))
    expect(billingFake.config.state.organisation.acceptsInsurance).toBe(false)
  })

  it('filters partners and adds an unlisted one', async () => {
    const user = setup()
    renderRoute(ROUTES.insurance)

    await user.click(await acceptRadio())
    await user.type(screen.getByLabelText('Search insurer or TPA'), 'star')
    expect(screen.queryByRole('checkbox', { name: /HDFC ERGO/ })).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Search insurer or TPA'))
    await user.click(screen.getByRole('button', { name: '+ Add an unlisted partner' }))
    await user.type(screen.getByLabelText(/Partner name/), 'Care Health Insurance')
    await user.selectOptions(screen.getByLabelText(/Partner type/), 'Insurer')
    await user.click(screen.getByRole('button', { name: 'Add partner' }))
    expect(screen.getByRole('checkbox', { name: /Care Health Insurance/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('saves the chosen partners when continuing', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.insurance)
    await chooseAcceptance(user)

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.insuranceAgreement))
    const { state } = billingFake.config
    expect(state.organisation.acceptsInsurance).toBe(true)
    expect(state.partners.filter((partner) => partner.active).map((partner) => partner.name)).toEqual(expect.arrayContaining(['HDFC ERGO General Insurance', 'Medi Assist Insurance TPA']))
  })

  it('sends a direct visit to the agreement step back to step 1', async () => {
    const router = renderRoute(ROUTES.insuranceAgreement)
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.insurance))
  })

  it('saves the agreement as a draft, reviews it and activates it', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.insurance)
    await chooseAcceptance(user)
    await screen.findByLabelText(/Agreement reference/)

    await user.click(screen.getByRole('button', { name: /Review insurance setup/ }))
    expect(screen.getByText('Choose the insurer for this agreement.')).toBeInTheDocument()
    expect(screen.getByText('Choose at least one branch.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Insurer/), 'HDFC ERGO General Insurance')
    await user.selectOptions(screen.getByLabelText(/Servicing TPA/), 'Medi Assist Insurance TPA')
    await user.type(screen.getByLabelText(/Agreement reference/), 'AGR-HYD-001')
    await user.type(screen.getByLabelText(/Proposed start date/), '2026-12-01')
    await user.type(screen.getByLabelText(/Proposed end date/), '2026-11-30')
    await user.click(screen.getByRole('checkbox', { name: /Main Clinic/ }))
    await user.click(screen.getByRole('checkbox', { name: 'OPD consultations' }))
    await user.click(screen.getByRole('button', { name: /Review insurance setup/ }))
    expect(screen.getByText('End date must be after the start date.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Proposed end date/))
    await user.type(screen.getByLabelText(/Proposed end date/), '2027-11-30')
    await user.click(screen.getByRole('button', { name: /Review insurance setup/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.insuranceReview))
    const [saved] = billingFake.config.state.agreements
    expect(saved).toMatchObject({ reference: 'AGR-HYD-001', startDate: '2026-12-01', endDate: '2027-11-30', status: 'draft', branchIds: ['b-main'] })
    const agreement = await screen.findByRole('region', { name: 'Partner & agreement' })
    expect(within(agreement).getByText('01 Dec 2026 – 30 Nov 2027')).toBeInTheDocument()
    expect(within(agreement).getByText('Medi Assist Insurance TPA')).toBeInTheDocument()

    const activate = screen.getByRole('button', { name: 'Activate agreement' })
    expect(activate).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /I have checked the signed agreement/ }))
    await user.click(activate)
    await waitFor(() => expect(billingFake.config.state.agreements[0].status).toBe('active'))
  })

  it('rejects an agreement file that is not a PDF', async () => {
    const user = userEvent.setup({ delay: null, applyAccept: false })
    renderRoute(ROUTES.insurance)
    await chooseAcceptance(user)

    await user.upload(await screen.findByLabelText(/Agreement document/), new File(['x'], 'scan.png', { type: 'image/png' }))
    expect(screen.getByText('Upload the agreement as a PDF.')).toBeInTheDocument()

    await user.upload(screen.getByLabelText(/Agreement document/), new File(['%PDF'], 'agreement.pdf', { type: 'application/pdf' }))
    expect(screen.getByText(/Will upload: agreement.pdf/)).toBeInTheDocument()
  })
})
