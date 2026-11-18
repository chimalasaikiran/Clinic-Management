import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { apiPatient, createPatientsApi } from '../../../test/fixtures/patientsApi'
import { createBillingApi, ledgerSeed } from '../../../test/fixtures/billingApi'
import { billingFake } from '../../../test/fixtures/billingFake'
import { renderRoute } from '../../../test/renderRoute'

// The patient and the clinical chart come from the API (faked here, seeded from test/fixtures/patients); the
// billing, family and communication records come from the in-memory fixtures, keyed by the same patient ids.
const fake = vi.hoisted(() => ({ api: null, state: null }))
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal()
  const forward = (name) => new Proxy({}, { get: (_, method) => (...args) => fake.api[name][method](...args) })
  return { ...actual, patientsApi: forward('patientsApi'), appointmentsApi: forward('appointmentsApi'), practitionersApi: forward('practitionersApi'), branchesApi: forward('branchesApi'), clinicalApi: forward('clinicalApi') }
})

beforeEach(() => {
  const created = createPatientsApi({
    patients: [
      apiPatient({ id: 'pt-000184', mrn: 'PT-000184', fullName: 'Ananya Sharma', mobile: '9845211029' }),
      apiPatient({ id: 'pt-000789', mrn: 'PT-000789', fullName: 'Kavita S. Deshpande', mobile: '9922481092', dateOfBirth: '2018-03-02', bloodGroup: 'A+' }),
    ],
  })
  fake.api = created.api
  fake.state = created.state
})

// What the screens sent to the (fake) API, and the fake's stored charts.
const patientsApiFake = {
  calls: (name) => fake.state.calls.filter(([call]) => call === name).map(([, ...args]) => args),
  get state() {
    return fake.state
  },
}

const ananya = { patientId: 'pt-000184' }
const setup = () => userEvent.setup({ delay: null })
const tab = (pattern) => pathFor(pattern, ananya)

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

const dialog = () => screen.getByRole('dialog')

// Renders a patient hub page and waits for the patient to load from the API.
async function openHub(path) {
  const router = renderRoute(path)
  await screen.findByRole('navigation', { name: 'Patient sections' })
  return router
}

// The billing tab loads the patient's ledger from the (faked) billing API before it shows anything.
async function openBilling() {
  const router = await openHub(tab(ROUTES.patientBilling))
  await screen.findByRole('tablist', { name: 'Ledger view' })
  return router
}

// Without the pending ₹1,500 refund request, PAY-2026-112 holds ₹1,500 of credit the desk can apply.
function withCredit() {
  const seed = ledgerSeed()
  seed.refunds = seed.refunds.filter((refund) => refund.reference !== 'REF-2026-018')
  billingFake.use(createBillingApi({ seed }))
}

describe('overview tab', () => {
  it('derives attention items and billing from the records', async () => {
    await openHub(pathFor(ROUTES.patientHub, ananya))

    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText(/awaiting validation/)).toBeInTheDocument()
    expect(await screen.findByText('₹3,500.00')).toBeInTheDocument()
    expect(screen.getByText('Ravi Sharma')).toBeInTheDocument()
  })

  it('starts a new patient with honest empty states', async () => {
    await openHub('/patients/pt-000789')

    expect(screen.getByText('Nothing needs attention right now.')).toBeInTheDocument()
    expect(screen.getByText('No activity has been recorded yet.')).toBeInTheDocument()
    expect(screen.getByText('No family or caregiver is linked yet.')).toBeInTheDocument()
  })
})

describe('clinical records tab', () => {
  it('requires a disposition and justification before acknowledging an alert', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientRecords))

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
    await openHub(tab(ROUTES.patientRecords))

    await user.click(screen.getByRole('button', { name: 'Open allergy Penicillin' }))
    expect(within(dialog()).getAllByText(/Penicillin/).length).toBeGreaterThan(0)
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
    await openHub(tab(ROUTES.patientRecords))

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
    await openHub(tab(ROUTES.patientPrescriptions))

    expect(screen.getByText('Atorvastatin Tablets')).toBeInTheDocument()
    expect(screen.getByText('Metoprolol Tartrate ER (Succinate)')).toBeInTheDocument()
    expect(screen.getByText('0 Refills remaining (Needs renewal)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'View Rx details for Atorvastatin Tablets' }))
    expect(within(dialog()).getByText('Prescription Detail')).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('button', { name: 'Audit Ledger' }))
    expect(within(dialog()).getByText('Prescription activity')).toBeInTheDocument()
    expect(within(dialog()).getByText('Prescription authorized & signed')).toBeInTheDocument()
    // There is no pharmacy module yet, so nothing has been dispensed.
    await user.click(within(dialog()).getByRole('tab', { name: 'Dispensing' }))
    expect(within(dialog()).getByText('No events of this type were recorded for this prescription.')).toBeInTheDocument()
  })

  it('discontinues a prescription with a reason', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientPrescriptions))

    await user.click(screen.getByRole('button', { name: 'View Rx details for Atorvastatin Tablets' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Discontinue' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Confirm Discontinue' }))
    expect(within(dialog()).getByText(/at least 10 characters/)).toBeInTheDocument()
    await fill(user, within(dialog()).getByLabelText(/reason for discontinuing/i), 'Replaced by a lower-dose statin.')
    await user.click(within(dialog()).getByRole('button', { name: 'Confirm Discontinue' }))

    await waitFor(() => expect(patientsApiFake.calls('clinical.discontinuePrescription')[0]).toEqual(['RX-2026-0894-A', 'Replaced by a lower-dose statin.']))
    expect(await within(dialog()).findByText(/Discontinued by Dr\. Rahul Mehta: Replaced by a lower-dose statin\./)).toBeInTheDocument()
  })

  it('filters the history to discontinued prescriptions', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientPrescriptions))

    await user.click(screen.getByRole('tab', { name: /discontinued/i }))
    expect(screen.getByText('Telmisartan 40 mg')).toBeInTheDocument()
    expect(screen.queryByText('Pantoprazole 40 mg')).not.toBeInTheDocument()
  })
})

describe('orders & results tab', () => {
  it('signs off a result', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientOrders))

    await user.click(screen.getByRole('button', { name: 'Review Result' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Sign & Acknowledge Result' }))
    expect(within(dialog()).getByText('Select the clinical assessment outcome.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('radio', { name: /routine \/ discuss/i }))
    await fill(user, within(dialog()).getByLabelText(/clinician note/i), 'Discuss at the next visit.')
    await user.click(within(dialog()).getByRole('button', { name: 'Sign & Acknowledge Result' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Review Result' })).not.toBeInTheDocument())
    expect(patientsApiFake.calls('clinical.reviewResult')[0]).toEqual(['ORD-2026-1184', { outcome: 'routine', note: 'Discuss at the next visit.' }])
  })

  it('enters a critical result that flags the chart until a clinician reviews it', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientOrders))

    await user.click(screen.getByRole('button', { name: 'Enter Result' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save Result' }))
    expect(within(dialog()).getByText('Enter the result.')).toBeInTheDocument()
    await fill(user, within(dialog()).getByLabelText(/result and key findings/i), 'LDL 212 mg/dL; hs-CRP 9.8 mg/L.')
    await user.click(within(dialog()).getByRole('radio', { name: /^Critical/ }))
    await user.click(within(dialog()).getByRole('button', { name: 'Save Result' }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Review Result' })).toHaveLength(2))
    const chart = () => patientsApiFake.state.charts['pt-000184']
    expect(chart().alerts.find((alert) => alert.orderId === 'ORD-2026-1142')).toMatchObject({ kind: 'RESULT: CRITICAL', status: 'active' })

    await user.click(screen.getAllByRole('button', { name: 'Review Result' })[1])
    await user.click(within(dialog()).getByRole('radio', { name: /clinical action required/i }))
    await fill(user, within(dialog()).getByLabelText(/clinician note/i), 'Start high-intensity statin; recheck in 6 weeks.')
    await user.click(within(dialog()).getByRole('button', { name: 'Sign & Acknowledge Result' }))
    await waitFor(() => expect(chart().alerts.find((alert) => alert.orderId === 'ORD-2026-1142').status).toBe('resolved'))
  })

  it('tracks a specimen and cancels a processing order with a reason', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientOrders))

    await user.click(screen.getByRole('button', { name: 'Track Specimen' }))
    expect(within(dialog()).getByText('SPEC-8829104')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel Order' }))
    expect(within(dialog()).getByText(/at least 10 characters/)).toBeInTheDocument()
    await fill(user, within(dialog()).getByLabelText(/reason for cancelling/i), 'Duplicate of an outside lab order.')
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel Order' }))
    expect(await screen.findByText('Cancelled', { selector: 'span' })).toBeInTheDocument()
    expect(patientsApiFake.calls('clinical.cancelOrder')[0]).toEqual(['ORD-2026-1142', 'Duplicate of an outside lab order.'])
  })
})

describe('referrals tab', () => {
  it('logs a follow-up and moves the referral to the logged outcome', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientReferrals))

    await user.click(screen.getByRole('button', { name: 'Follow Up with Receiving Center →' }))
    await user.click(within(dialog()).getByRole('button', { name: /save follow-up/i }))
    expect(within(dialog()).getByText('Enter the receiving representative.')).toBeInTheDocument()
    expect(within(dialog()).getByText('Select a contact outcome.')).toBeInTheDocument()

    await fill(user, within(dialog()).getByLabelText(/receiving representative/i), 'Ms. Kavita Reddy')
    await fill(user, within(dialog()).getByLabelText(/recording staff member/i), 'Liaison desk')
    await user.click(within(dialog()).getByRole('radio', { name: /acceptance confirmed/i }))
    await fill(user, within(dialog()).getByLabelText(/conversation record/i), 'Consultant agreed to see the patient on Friday.')
    await user.click(within(dialog()).getByRole('button', { name: /save follow-up/i }))

    const row = await waitFor(() => screen.getByText('#REF-2026-084').closest('tr'))
    expect(await within(row).findByText('Accepted')).toBeInTheDocument()
  })

  it('accepts an inbound referral only after the checklist is complete', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientReferrals))

    await user.click(screen.getByRole('button', { name: 'Review Referral & Triage →' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Accept Referral' }))
    expect(within(dialog()).getByText('Complete the clinical review checklist before accepting.')).toBeInTheDocument()

    for (const box of within(dialog()).getAllByRole('checkbox')) await user.click(box)
    await user.click(within(dialog()).getByRole('button', { name: 'Accept Referral' }))
    const row = screen.getByText('#IN-REF-2026-192').closest('tr')
    expect(await within(row).findByText('Accepted')).toBeInTheDocument()
  })

  it('creates an outbound referral that starts pending acceptance', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientReferrals))

    await user.click(screen.getByRole('button', { name: 'Create referral' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Create & Authorize Referral' }))
    expect(within(dialog()).getByText('Choose a destination specialist or facility.')).toBeInTheDocument()

    await user.selectOptions(within(dialog()).getByLabelText(/target specialist/i), 'dr-1')
    await fill(user, within(dialog()).getByLabelText(/primary clinical indication/i), 'Annual retinopathy screening')
    await fill(user, within(dialog()).getByLabelText(/clinical narrative/i), 'Diabetic screening is due this year.')
    await user.click(within(dialog()).getByRole('button', { name: 'Create & Authorize Referral' }))

    expect(patientsApiFake.calls('clinical.refer')[0]).toEqual(['pt-000184', expect.objectContaining({ direction: 'outgoing', targetPractitionerId: 'dr-1', indication: 'Annual retinopathy screening' })])
    const row = (await screen.findByText('Annual retinopathy screening')).closest('tr')
    expect(within(row).getByText('Pending Acceptance')).toBeInTheDocument()
  })

  it('refers to an outside facility typed in by hand', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientReferrals))

    await user.click(screen.getByRole('button', { name: 'Create referral' }))
    await user.selectOptions(within(dialog()).getByLabelText(/target specialist/i), 'external')
    await fill(user, within(dialog()).getByLabelText(/^facility/i), 'City Eye Hospital')
    await fill(user, within(dialog()).getByLabelText(/^specialty/i), 'Retina & Vitreous')
    await fill(user, within(dialog()).getByLabelText(/primary clinical indication/i), 'Annual retinopathy screening')
    await fill(user, within(dialog()).getByLabelText(/clinical narrative/i), 'Diabetic screening is due this year.')
    await user.click(within(dialog()).getByRole('button', { name: 'Create & Authorize Referral' }))

    await waitFor(() => expect(patientsApiFake.calls('clinical.refer')[0]).toEqual(['pt-000184', expect.objectContaining({ facility: 'City Eye Hospital', specialty: 'Retina & Vitreous' })]))
  })
})

describe('billing tab', () => {
  it('shows the ledger summary and flags unallocated credit', async () => {
    withCredit()
    await openBilling()

    expect(screen.getAllByText('₹3,500').length).toBeGreaterThan(0)
    expect(screen.getByText('₹62,500')).toBeInTheDocument()
    expect(screen.getByText(/Invoice Due & Unallocated Payment Available/)).toBeInTheDocument()
  })

  it('keeps credit held by a pending refund out of the allocation prompt', async () => {
    await openBilling()

    expect(screen.queryByText(/Invoice Due & Unallocated Payment Available/)).not.toBeInTheDocument()
  })

  it('applies unallocated credit to the open invoice', async () => {
    withCredit()
    const user = setup()
    await openBilling()

    await user.click(screen.getByRole('button', { name: /allocate ₹1,500 to invoice/i }))
    await user.click(within(dialog()).getByRole('button', { name: /confirm & commit allocation/i }))
    expect(within(dialog()).getByText('Select an invoice and enter an amount to allocate.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('checkbox', { name: /INV-2026-084/ }))
    await user.click(within(dialog()).getByRole('button', { name: /confirm & commit allocation/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent('Allocated ₹1,500.00 from PAY-2026-112.')
    expect(screen.getByText('₹0', { selector: 'dd' })).toBeInTheDocument()
    expect(billingFake.current.calls).toContainEqual(['allocate', 'u-PAY-2026-112', { invoiceId: 'u-INV-2026-084', amount: 1500 }])
  })

  it('records a payment that settles the invoice', async () => {
    const user = setup()
    await openBilling()

    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    await user.click(within(dialog()).getByRole('button', { name: /record payment & commit/i }))
    expect(within(dialog()).getByText('Enter the amount received.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: /pay full balance/i }))
    await user.click(within(dialog()).getByRole('button', { name: /record payment & commit/i }))

    expect(await screen.findByText('#PAY-000001')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const invoiceRow = screen.getByText('#INV-2026-084').closest('tr')
    expect(within(invoiceRow).getByText('Paid in Full')).toBeInTheDocument()
  })

  it('submits a refund of the unallocated credit for approval', async () => {
    withCredit()
    const user = setup()
    await openBilling()

    await user.click(screen.getByRole('button', { name: 'View PAY-2026-112' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Refund' }))
    await user.click(within(dialog()).getByRole('button', { name: /submit refund for approval/i }))
    expect(within(dialog()).getByText('Select a statutory reason.')).toBeInTheDocument()

    await user.selectOptions(within(dialog()).getByLabelText(/statutory reason/i), 'Duplicate payment')
    await fill(user, within(dialog()).getByLabelText(/clinical & cashier justification/i), 'Patient paid twice at the desk.')
    await user.click(within(dialog()).getByRole('button', { name: /submit refund for approval/i }))

    expect(await screen.findByRole('status')).toHaveTextContent('Refund request RFD-000001 of ₹1,500.00 submitted for approval against PAY-2026-112.')
    expect(billingFake.current.calls.find(([name]) => name === 'requestRefund')[1]).toMatchObject({ paymentId: 'u-PAY-2026-112', amount: 1500, reason: 'Duplicate payment', releasesAllocations: false })
  })

  it('issues an invoice from unbilled charges and marks them invoiced', async () => {
    const user = setup()
    await openBilling()

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))
    await user.click(within(dialog()).getByRole('button', { name: /review & issue invoice/i }))
    expect(within(dialog()).getByText('Add at least one billable line.')).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('checkbox', { name: /Comprehensive Cardiology Review & ECG/ }))
    expect(within(dialog()).getAllByText('₹1,500.00').length).toBeGreaterThan(0)
    await user.click(within(dialog()).getByRole('button', { name: /review & issue invoice/i }))

    expect(await screen.findByText('#INV-000001')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Linked Inv CHG-2026-320' })).toBeInTheDocument()
  })

  it('adds a priced catalogue service to an invoice', async () => {
    const user = setup()
    await openBilling()

    await user.click(screen.getByRole('button', { name: 'Create invoice' }))
    await user.click(within(dialog()).getByRole('tab', { name: 'Service Catalogue' }))
    expect(within(dialog()).queryByRole('button', { name: 'Add Cardiac Follow-up' })).not.toBeInTheDocument()
    await user.click(within(dialog()).getByRole('button', { name: 'Add General Physician Consultation' }))
    await user.click(within(dialog()).getByRole('button', { name: /review & issue invoice/i }))

    expect(await screen.findByText('#INV-000001')).toBeInTheDocument()
    expect(billingFake.current.calls.find(([name]) => name === 'createInvoice')[1]).toMatchObject({ patientId: 'pt-000184', chargeIds: [], items: [{ serviceId: 'srv-gmed-01', quantity: 1 }] })
  })

  it('shows the billing tab only to finance roles', async () => {
    billingFake.use({ ...createBillingApi(), api: { ...createBillingApi().api, ledger: () => Promise.reject(Object.assign(new Error('Forbidden'), { status: 403 })) } })
    await openHub(tab(ROUTES.patientBilling))

    expect(await screen.findByText('Billing is not part of your role')).toBeInTheDocument()
  })

  it('opens the receipt voucher with the amount in words', async () => {
    const user = setup()
    await openBilling()

    await user.click(screen.getByRole('button', { name: 'Receipt PAY-2026-112' }))
    expect(within(dialog()).getByText('Indian Rupees Seven Thousand Only')).toBeInTheDocument()
  })
})

describe('family & caregiver tab', () => {
  it('links a new person and lists them', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientFamily))

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
    await openHub(tab(ROUTES.patientFamily))

    await user.click(screen.getByRole('button', { name: 'Edit Meena Sharma' }))
    await user.click(within(dialog()).getByRole('switch', { name: 'Legal proxy' }))
    await user.click(within(dialog()).getByRole('button', { name: /save & commit changes/i }))
    expect(within(dialog()).getByText('A legal proxy needs a verified document identifier.')).toBeInTheDocument()
  })

  it('filters to emergency contacts', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientFamily))

    await user.click(screen.getByRole('tab', { name: /emergency contacts/i }))
    const table = screen.getByRole('table')
    expect(within(table).queryByText('Vikram Sharma')).not.toBeInTheDocument()
    expect(within(table).getByText('Ravi Sharma')).toBeInTheDocument()
  })
})

describe('communication tab', () => {
  it('sends a composed message to the patient', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientCommunication))

    await user.click(screen.getByRole('button', { name: 'New message' }))
    await user.click(within(dialog()).getByRole('button', { name: /send message via whatsapp/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('#MSG-0413')).toBeInTheDocument()
  })

  it('replies to an inbound message and clears the awaiting count', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientCommunication))

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
    await openHub(tab(ROUTES.patientCommunication))

    expect(screen.getByText('1 Failed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry MSG-0377 via WhatsApp' }))
    expect(screen.getByText('0 Failed')).toBeInTheDocument()
    expect(screen.getByText('Superseded by WhatsApp')).toBeInTheDocument()
  })

  it('renews an expiring consent and withdraws an active one', async () => {
    const user = setup()
    await openHub(tab(ROUTES.patientCommunication))

    await user.click(screen.getByRole('button', { name: /manage consent artifacts/i }))
    await user.click(screen.getByRole('button', { name: 'Renew ABDM Health Data Sharing & Care Context' }))
    expect(screen.queryByRole('button', { name: /Renew ABDM/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Withdraw Teleconsultation & Remote Care Monitoring' }))
    const row = screen.getByText('Teleconsultation & Remote Care Monitoring').closest('tr')
    expect(within(row).getByText('Withdrawn')).toBeInTheDocument()
  })
})
