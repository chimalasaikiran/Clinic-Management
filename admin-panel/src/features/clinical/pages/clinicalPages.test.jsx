import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })
const ananya = { patientId: 'pt-000184' }
const dialog = () => screen.getByRole('dialog')

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

beforeEach(() => localStorage.clear())

describe('clinical hub', () => {
  it('shows the safety exceptions and tiles that the records produce', () => {
    renderRoute(ROUTES.clinical)

    expect(screen.getByRole('heading', { name: 'Clinical', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/2 unresolved/)).toBeInTheDocument()
    expect(screen.getByText('REF: ALT-88102')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review & Resolve Alert \[ALT-88102\]/ })).toBeInTheDocument()
    expect(screen.getByText('RED ALERT TRIAGE REQUIRED')).toBeInTheDocument()
  })

  it('takes the owner-only scope out of clinical sign-off', async () => {
    const user = setup()
    renderRoute(ROUTES.clinical)

    await user.click(screen.getByRole('button', { name: 'Owner Only (Management Scope)' }))
    expect(screen.getByText(/Owner access does not grant clinical sign-off/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Review & Resolve Alert/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Review & Resolve Alert/ })).toBeDisabled()
  })

  it('calls the next token from the work queue into the start-encounter step', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.clinical)

    await user.click(screen.getByRole('tab', { name: /Clinic-Wide Operational Overview/ }))
    await user.click(screen.getByRole('tab', { name: /Ready for Rooming/ }))
    expect(screen.getAllByText('Ready for Rooming').length).toBeGreaterThan(1)
    await user.click(screen.getAllByRole('button', { name: /Call Next Token/ })[0])
    expect(router.state.location.pathname).toMatch(/\/start-encounter$/)
  })
})

describe('create care plan', () => {
  it('needs goals and interventions, warns about a duplicate category and then activates onto the record', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.patientCarePlanNew, ananya))

    await user.click(screen.getByRole('button', { name: /Activate & Link to Patient Record/ }))
    expect(screen.getByText('Enter the care plan title.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one measurable clinical goal.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one planned intervention.')).toBeInTheDocument()
    expect(screen.getByText(/Clinical decision support: REVIEW/)).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/care plan title/i), 'Metabolic & Lipid Optimization Plan')
    await fill(user, screen.getByLabelText(/clinical rationale/i), 'Titrate lipid-lowering therapy and monitor glycaemic control.')
    await user.click(screen.getByRole('button', { name: '+ Add Clinical Goal' }))
    await user.click(screen.getByRole('button', { name: 'Add goal' }))
    expect(screen.getByText('Name the goal.')).toBeInTheDocument()
    await fill(user, screen.getByLabelText(/^goal/i), 'Glycemic & lipid control')
    await fill(user, screen.getByLabelText(/target metric/i), 'LDL-C < 55 mg/dL, HbA1c ≤ 6.8%')
    await user.click(screen.getByRole('button', { name: 'Add goal' }))
    await user.click(screen.getByRole('button', { name: '+ Add Intervention' }))
    await fill(user, screen.getByLabelText(/^intervention/i), 'Repeat lipid panel at day 90')
    await user.click(screen.getByRole('button', { name: 'Add intervention' }))
    await user.click(screen.getByRole('button', { name: /Activate & Link to Patient Record/ }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.patientRecords, ananya))
    expect(await screen.findByText('Metabolic & Lipid Optimization Plan')).toBeInTheDocument()
  }, 30000)

  it('remembers an unfinished draft', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.patientCarePlanNew, ananya))
    await fill(user, screen.getByLabelText(/care plan title/i), 'Half-written plan')
    expect(localStorage.getItem('care-plan-draft:pt-000184')).toContain('Half-written plan')
  })
})

describe('care plan progress review', () => {
  it('blocks completing a follow-up with a worsening goal until it is escalated, then raises an alert', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.patientRecords, ananya))

    await user.click(screen.getByRole('button', { name: 'View full care plan →' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Update Progress' }))
    const worsening = within(dialog()).getAllByRole('radio', { name: 'Worsening' })
    await user.click(worsening[0])
    await user.click(within(dialog()).getAllByRole('radio', { name: 'Unchanged' })[1])
    await user.click(within(dialog()).getAllByRole('radio', { name: 'Achieved' })[2])
    await fill(user, within(dialog()).getByLabelText(/general clinical progress observation/i), 'Resting systolic remains above target.')
    await fill(user, within(dialog()).getByLabelText(/next scheduled review/i), '2026-11-20')
    await user.click(within(dialog()).getByRole('button', { name: /Complete Follow-up/ }))
    expect(within(dialog()).getByText(/must be escalated for attending review/)).toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: 'Escalate for Attending Review' }))
    expect(within(dialog()).getByText('Progress saved')).toBeInTheDocument()

    await act(() => router.navigate(ROUTES.clinical))
    expect(await screen.findByText(/Care plan escalated for attending review/)).toBeInTheDocument()
  })
})

describe('clinical incident report', () => {
  it('needs a category, severity and narrative, and demands actions for a moderate harm event', async () => {
    const user = setup()
    renderRoute(ROUTES.incidentNew)

    await user.click(screen.getByRole('button', { name: /Submit Confidential Incident Report/ }))
    expect(screen.getByText('Choose the incident category.')).toBeInTheDocument()
    expect(screen.getByText('Choose the harm severity.')).toBeInTheDocument()
    expect(screen.getByText(/Write a one-line summary/)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Medication \/ Prescription Error/ }))
    await user.click(screen.getByRole('radio', { name: /Level 4/ }))
    await fill(user, screen.getByLabelText(/incident summary headline/i), 'Wrong dose staged for a cardiac patient')
    await fill(user, screen.getByLabelText(/detailed clinical chronology/i), 'The order was staged at double the intended dose and caught at the counter.')
    await user.click(screen.getByRole('button', { name: /Submit Confidential Incident Report/ }))
    expect(screen.getByText(/Record the immediate corrective actions/)).toBeInTheDocument()
  })

  it('files a sentinel report that appears on the hub and raises a critical alert', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.incidentNew)

    await user.click(screen.getByRole('radio', { name: /Diagnostic \/ Lab \/ Specimen Error/ }))
    await user.click(screen.getByRole('radio', { name: /Level 5/ }))
    await fill(user, screen.getByLabelText(/incident summary headline/i), 'Critical potassium result not escalated')
    await fill(user, screen.getByLabelText(/detailed clinical chronology/i), 'A critical panic value was resulted and sat unacknowledged for an hour.')
    await fill(user, screen.getByLabelText(/immediate corrective action/i), 'Patient recalled and treated; result process reviewed.')
    await user.click(screen.getByRole('button', { name: /Submit Confidential Incident Report/ }))

    expect(router.state.location.pathname).toBe(ROUTES.clinical)
    expect(screen.getByRole('status')).toHaveTextContent('Incident INC-2026-0001 was submitted')
    expect(screen.getByText('Reported clinical incidents')).toBeInTheDocument()
    expect(screen.getByText('SENTINEL EVENT')).toBeInTheDocument()
    expect(localStorage.getItem('incident-draft')).toBeNull()
  })
})
