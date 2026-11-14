import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const ananya = { patientId: 'pt-000184' }
const setup = () => userEvent.setup({ delay: null })
const tab = (pattern) => pathFor(pattern, ananya)

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

const dialog = () => screen.getByRole('dialog')

describe('overview tab', () => {
  it('derives attention items and billing from the records', () => {
    renderRoute(pathFor(ROUTES.patientHub, ananya))

    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText(/awaiting validation/)).toBeInTheDocument()
    expect(screen.getByText('₹3,500.00')).toBeInTheDocument()
    expect(screen.getByText('Ravi Sharma')).toBeInTheDocument()
  })

  it('starts a new patient with honest empty states', () => {
    renderRoute('/patients/pt-000789')

    expect(screen.getByText('Nothing needs attention right now.')).toBeInTheDocument()
    expect(screen.getByText('No activity has been recorded yet.')).toBeInTheDocument()
    expect(screen.getByText('No family or caregiver is linked yet.')).toBeInTheDocument()
  })
})

describe('clinical records tab', () => {
  it('requires a disposition and justification before acknowledging an alert', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientRecords))

    expect(screen.getByText(/\(3 Active Alerts\)/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acknowledge Safety Context' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Acknowledge with Mitigation' }))
    expect(within(dialog()).getByText('Select a clinical disposition.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('radio', { name: /clinical risk acknowledged/i }))
    await fill(user, within(dialog()).getByLabelText(/clinical justification/i), 'Benefit outweighs the documented risk.')
    await user.click(within(dialog()).getByRole('button', { name: 'Acknowledge with Mitigation' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/\(2 Active Alerts\)/)).toBeInTheDocument()
  })

  it('opens the allergy, vital and note detail drawers', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientRecords))

    await user.click(screen.getByRole('button', { name: 'Open allergy Penicillin' }))
    expect(within(dialog()).getByText('Amoxicillin Trihydrate')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Open blood pressure detail' }))
    expect(within(dialog()).getByText('Blood Pressure (Systolic & Diastolic)')).toBeInTheDocument()
    expect(within(dialog()).getAllByRole('row').length).toBeGreaterThan(3)
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'View note Post-CABG 3-Month Outpatient Review' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Create Addendum / Correction' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save addendum' }))
    expect(within(dialog()).getByText('Write the addendum (at least 10 characters).')).toBeInTheDocument()
    await fill(user, within(dialog()).getByLabelText('Addendum text'), 'Clarified BP reading from the right arm.')
    await user.click(within(dialog()).getByRole('button', { name: 'Save addendum' }))
    expect(within(dialog()).getByText('Clarified BP reading from the right arm.')).toBeInTheDocument()
  })

  it('records a structured progress review against the care plan', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientRecords))

    await user.click(screen.getByRole('button', { name: 'View full care plan →' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Update Progress' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save Progress' }))
    expect(within(dialog()).getByText('Record the general clinical progress observation (at least 10 characters).')).toBeInTheDocument()

    await user.click(within(dialog()).getAllByRole('radio', { name: 'Improving / On Target' })[0])
    await fill(user, within(dialog()).getByLabelText(/general clinical progress observation/i), 'Walks 25 minutes daily without symptoms.')
    await user.click(within(dialog()).getByRole('button', { name: 'Save Progress' }))
    expect(within(dialog()).getByText('Progress saved')).toBeInTheDocument()
  })
})

describe('prescriptions tab', () => {
  it('shows the four active medications and opens detail and activity', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientPrescriptions))

    expect(screen.getByText('Atorvastatin Tablets')).toBeInTheDocument()
    expect(screen.getByText('Metoprolol Tartrate ER (Succinate)')).toBeInTheDocument()
    expect(screen.getByText('0 Refills remaining (Needs renewal)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View Rx details for Atorvastatin Tablets' }))
    expect(within(dialog()).getByText('Prescription Detail')).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('button', { name: 'Audit Ledger' }))
    expect(within(dialog()).getByText('Prescription activity')).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('tab', { name: 'Dispensing' }))
    expect(within(dialog()).getByText(/Pharmacy acknowledged/)).toBeInTheDocument()
  })

  it('filters the history to discontinued prescriptions', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientPrescriptions))

    await user.click(screen.getByRole('tab', { name: /discontinued/i }))
    expect(screen.getByText(/Switched to Olmesartan|Discontinued \(Replaced\)/)).toBeInTheDocument()
  })
})

describe('orders & results tab', () => {
  it('signs off a result and clears the linked safety alert', async () => {
    const user = setup()
    const router = renderRoute(tab(ROUTES.patientOrders))

    await user.click(screen.getByRole('button', { name: 'Review Result' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Sign & Acknowledge Result' }))
    expect(within(dialog()).getByText('Select the clinical assessment outcome.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('radio', { name: /routine \/ discuss/i }))
    await fill(user, within(dialog()).getByLabelText(/clinician note/i), 'Discuss at the next visit.')
    await user.click(within(dialog()).getByRole('button', { name: 'Sign & Acknowledge Result' }))

    expect(screen.queryByRole('button', { name: 'Review Result' })).not.toBeInTheDocument()
    await act(() => router.navigate(tab(ROUTES.patientRecords)))
    expect(await screen.findByText(/\(2 Active Alerts\)/)).toBeInTheDocument()
  })

  it('tracks a specimen and cancels a processing order', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientOrders))

    await user.click(screen.getByRole('button', { name: 'Track Specimen' }))
    expect(within(dialog()).getByText('SPEC-8829104')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Cancelled', { selector: 'span' })).toBeInTheDocument()
  })
})

describe('referrals tab', () => {
  it('logs a follow-up and moves the referral to the logged outcome', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientReferrals))

    await user.click(screen.getByRole('button', { name: 'Follow Up with Receiving Center →' }))
    await user.click(within(dialog()).getByRole('button', { name: /save follow-up/i }))
    expect(within(dialog()).getByText('Enter the receiving representative.')).toBeInTheDocument()
    expect(within(dialog()).getByText('Select a contact outcome.')).toBeInTheDocument()

    await fill(user, within(dialog()).getByLabelText(/receiving representative/i), 'Ms. Kavita Reddy')
    await user.click(within(dialog()).getByRole('radio', { name: /acceptance confirmed/i }))
    await fill(user, within(dialog()).getByLabelText(/conversation record/i), 'Consultant agreed to see the patient on Friday.')
    await user.click(within(dialog()).getByRole('button', { name: /save follow-up/i }))

    const row = screen.getByText('#REF-2026-084').closest('tr')
    expect(within(row).getByText('Accepted')).toBeInTheDocument()
  })

  it('accepts an inbound referral only after the checklist is complete', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientReferrals))

    await user.click(screen.getByRole('button', { name: 'Review Referral & Triage →' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Accept Referral' }))
    expect(within(dialog()).getByText('Complete the clinical review checklist before accepting.')).toBeInTheDocument()

    for (const box of within(dialog()).getAllByRole('checkbox')) await user.click(box)
    await user.click(within(dialog()).getByRole('button', { name: 'Accept Referral' }))
    const row = screen.getByText('#IN-REF-2026-192').closest('tr')
    expect(within(row).getByText('Accepted')).toBeInTheDocument()
  })

  it('creates an outbound referral that starts pending acceptance', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientReferrals))

    await user.click(screen.getByRole('button', { name: 'Create referral' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Create & Authorize Referral' }))
    expect(within(dialog()).getByText('Choose a destination specialist or facility.')).toBeInTheDocument()

    await user.selectOptions(within(dialog()).getByLabelText(/target specialist/i), 'mohan-eye')
    await fill(user, within(dialog()).getByLabelText(/primary clinical indication/i), 'Annual retinopathy screening')
    await fill(user, within(dialog()).getByLabelText(/clinical narrative/i), 'Diabetic screening is due this year.')
    await user.click(within(dialog()).getByRole('button', { name: 'Create & Authorize Referral' }))

    const row = (await screen.findByText('#REF-2026-085')).closest('tr')
    expect(within(row).getByText('Pending Acceptance')).toBeInTheDocument()
  })
})

describe('billing tab', () => {
  it('shows the ledger summary and flags unallocated credit', () => {
    renderRoute(tab(ROUTES.patientBilling))

    expect(screen.getAllByText('₹3,500').length).toBeGreaterThan(0)
    expect(screen.getByText('₹62,500')).toBeInTheDocument()
    expect(screen.getByText(/Invoice Due & Unallocated Payment Available/)).toBeInTheDocument()
  })

  it('applies unallocated credit to the open invoice', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientBilling))

    await user.click(screen.getByRole('button', { name: /allocate ₹2,000 to invoice/i }))
    await user.click(within(dialog()).getByRole('button', { name: /confirm & commit allocation/i }))
    expect(within(dialog()).getByText('Select an invoice and enter an amount to allocate.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('checkbox', { name: /INV-2026-084/ }))
    await user.click(within(dialog()).getByRole('button', { name: /confirm & commit allocation/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByText('₹1,500').length).toBeGreaterThan(0)
    expect(screen.getByText('₹0', { selector: 'dd' })).toBeInTheDocument()
  })

  it('records a payment that settles the invoice', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientBilling))

    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    await user.click(within(dialog()).getByRole('button', { name: /record payment & commit/i }))
    expect(within(dialog()).getByText('Enter the amount received.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: /pay full balance/i }))
    await user.click(within(dialog()).getByRole('button', { name: /record payment & commit/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('#PAY-2026-113')).toBeInTheDocument()
    const invoiceRow = screen.getByText('#INV-2026-084').closest('tr')
    expect(within(invoiceRow).getByText('Paid in Full')).toBeInTheDocument()
  })

  it('refunds the unallocated credit and records the refund in the ledger', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientBilling))

    await user.click(screen.getByRole('button', { name: 'View PAY-2026-112' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Refund' }))
    await user.click(within(dialog()).getByRole('button', { name: /authorize & commit refund/i }))
    expect(within(dialog()).getByText('Select a statutory reason.')).toBeInTheDocument()

    await user.selectOptions(within(dialog()).getByLabelText(/statutory reason/i), 'Duplicate Payment')
    await fill(user, within(dialog()).getByLabelText(/clinical & cashier justification/i), 'Patient paid twice at the desk.')
    await user.click(within(dialog()).getByRole('button', { name: /authorize & commit refund/i }))

    expect(screen.getByText('#RFD-2026-001')).toBeInTheDocument()
  })

  it('issues an invoice from unbilled charges and marks them invoiced', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientBilling))

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))
    await user.click(within(dialog()).getByRole('button', { name: /review & issue invoice/i }))
    expect(within(dialog()).getByText('Add at least one billable line.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('checkbox', { name: /Comprehensive Cardiology Review & ECG/ }))
    expect(within(dialog()).getAllByText('₹1,500.00').length).toBeGreaterThan(0)
    await user.click(within(dialog()).getByRole('button', { name: /review & issue invoice/i }))

    expect(screen.getByText('#INV-2026-085')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Linked Inv CHG-2026-320' })).toBeInTheDocument()
  })

  it('opens the receipt voucher with the amount in words', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientBilling))

    await user.click(screen.getByRole('button', { name: 'Receipt PAY-2026-112' }))
    expect(within(dialog()).getByText('Indian Rupees Seven Thousand Only')).toBeInTheDocument()
  })
})

describe('family & caregiver tab', () => {
  it('links a new person and lists them', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientFamily))

    await user.click(screen.getAllByRole('button', { name: /add person/i })[0])
    await user.click(within(dialog()).getByRole('button', { name: /save & link related person/i }))
    expect(within(dialog()).getByText('Enter the full legal name.')).toBeInTheDocument()
    expect(within(dialog()).getByText('Choose the relationship.')).toBeInTheDocument()

    await fill(user, within(dialog()).getByLabelText(/full legal name/i), 'Sunita Sharma')
    await user.selectOptions(within(dialog()).getByLabelText(/kinship/i), 'Sister')
    await fill(user, within(dialog()).getByLabelText(/primary mobile number/i), '9876501234')
    await user.click(within(dialog()).getByRole('button', { name: /save & link related person/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Sunita Sharma')).toBeInTheDocument()
    expect(screen.getByText('4 Linked Entities')).toBeInTheDocument()
  })

  it('requires a verified document for a legal proxy', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientFamily))

    await user.click(screen.getByRole('button', { name: 'Edit Meena Sharma' }))
    await user.click(within(dialog()).getByRole('switch', { name: 'Legal proxy' }))
    await user.click(within(dialog()).getByRole('button', { name: /save & commit changes/i }))
    expect(within(dialog()).getByText('A legal proxy needs a verified document identifier.')).toBeInTheDocument()
  })

  it('filters to emergency contacts', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientFamily))

    await user.click(screen.getByRole('tab', { name: /emergency contacts/i }))
    const table = screen.getByRole('table')
    expect(within(table).queryByText('Vikram Sharma')).not.toBeInTheDocument()
    expect(within(table).getByText('Ravi Sharma')).toBeInTheDocument()
  })
})

describe('communication tab', () => {
  it('sends a composed message to the patient', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientCommunication))

    await user.click(screen.getByRole('button', { name: 'New message' }))
    await user.click(within(dialog()).getByRole('button', { name: /send message via whatsapp/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('#MSG-0413')).toBeInTheDocument()
  })

  it('replies to an inbound message and clears the awaiting count', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientCommunication))

    expect(screen.getByText('1 Incoming')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reply to MSG-0411' }))
    await user.click(within(dialog()).getByRole('button', { name: /send reply/i }))
    expect(within(dialog()).getByText('Write the reply to send.')).toBeInTheDocument()

    await fill(user, within(dialog()).getByLabelText(/outbound reply composer/i), 'Please come tomorrow for a 12-lead ECG.')
    await user.click(within(dialog()).getByRole('button', { name: /send reply/i }))
    expect(screen.getByText('0 Incoming')).toBeInTheDocument()
  })

  it('retries a failed SMS over WhatsApp', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientCommunication))

    expect(screen.getByText('1 Failed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry MSG-0377 via WhatsApp' }))
    expect(screen.getByText('0 Failed')).toBeInTheDocument()
    expect(screen.getByText('Superseded by WhatsApp')).toBeInTheDocument()
  })

  it('renews an expiring consent and withdraws an active one', async () => {
    const user = setup()
    renderRoute(tab(ROUTES.patientCommunication))

    await user.click(screen.getByRole('button', { name: /manage consent artifacts/i }))
    await user.click(screen.getByRole('button', { name: 'Renew ABDM Health Data Sharing & Care Context' }))
    expect(screen.queryByRole('button', { name: /Renew ABDM/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Withdraw Teleconsultation & Remote Care Monitoring' }))
    const row = screen.getByText('Teleconsultation & Remote Care Monitoring').closest('tr')
    expect(within(row).getByText('Withdrawn')).toBeInTheDocument()
  })
})
