import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { authState } from '../../../test/auth'
import { createPatientsApi, fixturePatientsForApi } from '../../../test/fixtures/patientsApi'
import { WORKLIST } from '../../../test/fixtures/worklist'
import { renderRoute } from '../../../test/renderRoute'
// Patients come from the (faked) API; the clinical and billing records from the in-memory fixtures.
const patientsApiFake = vi.hoisted(() => ({ api: null, state: null, calls: (name) => patientsApiFake.state.calls.filter(([call]) => call === name).map(([, ...args]) => args) }))
vi.mock('../../patients/api', async (importOriginal) => {
  const actual = await importOriginal()
  const forward = (name) => new Proxy({}, { get: (_, method) => (...args) => patientsApiFake.api[name][method](...args) })
  return { ...actual, patientsApi: forward('patientsApi'), appointmentsApi: forward('appointmentsApi'), practitionersApi: forward('practitionersApi'), branchesApi: forward('branchesApi'), clinicalApi: forward('clinicalApi'), incidentsApi: forward('incidentsApi') }
})
// The incident form lists the clinic's staff as possible witnesses.
vi.mock('../../staff/api', () => ({ staffApi: { list: async () => ({ data: [{ id: 's-1', fullName: 'Priya Nair', designation: 'Staff Nurse' }], meta: { page: 1, pageSize: 100, total: 1 } }) } }))
beforeEach(() => {
  const created = createPatientsApi({ patients: fixturePatientsForApi() })
  patientsApiFake.api = created.api
  patientsApiFake.state = created.state
})


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
  beforeEach(() => {
    patientsApiFake.api.clinicalApi.worklist = async () => WORKLIST
  })

  it('shows the safety exceptions and tiles from the worklist', async () => {
    renderRoute(ROUTES.clinical)

    expect(screen.getByRole('heading', { name: 'Clinical', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText(/1 unresolved/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Review & Resolve Alert/ })).toHaveAttribute('href', '/patients/pt-000184/records')
    expect(screen.getByText('RED ALERT TRIAGE REQUIRED')).toBeInTheDocument()
    expect(screen.getByText('Can document and sign encounters')).toBeInTheDocument()
  })

  it('keeps sign-off away from roles without clinical write access', async () => {
    renderRoute(ROUTES.clinical, undefined, { auth: authState({ permissions: ['dashboard.view', 'clinical.read', 'patients.view'] }) })
    expect(await screen.findByText('Your role cannot sign notes or acknowledge clinical results.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Review & Resolve Alert/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Review & Resolve Alert/ })).toBeDisabled()
  })

  it('calls the next token from the work queue into the start-encounter step', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.clinical)

    await screen.findByText(/1 unresolved/)
    await user.click(screen.getByRole('tab', { name: /Clinic-Wide Operational Overview/ }))
    await user.click(screen.getByRole('tab', { name: /Ready for Rooming/ }))
    await user.click(screen.getAllByRole('button', { name: /Call Next Token/ })[0])
    expect(router.state.location.pathname).toBe('/patients/pt-000184/appointment/a-1/start-encounter')
  })
})

describe('create care plan', () => {
  it('needs goals and interventions, warns about a duplicate category and then activates onto the record', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.patientCarePlanNew, ananya))

    await user.click(await screen.findByRole('button', { name: /Activate & Link to Patient Record/ }))
    expect(screen.getByText('Enter the care plan title.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one measurable clinical goal.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one planned intervention.')).toBeInTheDocument()
    expect(screen.getByText(/Clinical decision support: REVIEW/)).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/care plan title/i), 'Metabolic & Lipid Optimization Plan')
    await user.selectOptions(screen.getByLabelText(/Responsible attending clinician/), 'dr-1')
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

    await waitFor(() => expect(router.state.location.pathname).toBe(pathFor(ROUTES.patientRecords, ananya)))
    expect(patientsApiFake.calls('clinical.createCarePlan')[0]).toEqual(['pt-000184', expect.objectContaining({ title: 'Metabolic & Lipid Optimization Plan', leadPractitionerId: 'dr-1', goals: [expect.objectContaining({ title: 'Glycemic & lipid control' })], interventions: [expect.objectContaining({ title: 'Repeat lipid panel at day 90' })] })])
    expect(localStorage.getItem('care-plan-draft:pt-000184')).toBeNull()
  }, 30000)

  it('remembers an unfinished draft', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.patientCarePlanNew, ananya))
    await fill(user, await screen.findByLabelText(/care plan title/i), 'Half-written plan')
    expect(localStorage.getItem('care-plan-draft:pt-000184')).toContain('Half-written plan')
  })
})

describe('care plan progress review', () => {
  it('blocks completing a follow-up with a worsening goal until it is escalated, then raises an alert', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.patientRecords, ananya))

    await user.click(await screen.findByRole('button', { name: 'View full care plan →' }))
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

    // The server applies the review and raises the alert for the lead in one step.
    await waitFor(() => expect(patientsApiFake.calls('clinical.reviewCarePlan')[0]).toEqual(['CP-2026-CABG', expect.objectContaining({ mode: 'escalate', observation: 'Resting systolic remains above target.', version: 1 })]))
    expect(await screen.findByText('CLINICAL FLAG: CARE PLAN ESCALATION')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/patients/pt-000184/records')
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
    await user.click(screen.getByRole('checkbox', { name: /Priya Nair/ }))
    await user.click(screen.getByRole('checkbox', { name: /anonymous safe harbor/ }))
    await user.click(screen.getByRole('button', { name: /Submit Confidential Incident Report/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.clinical))
    expect(patientsApiFake.calls('incidents.report')[0][0]).toMatchObject({ category: 'diagnostic', severity: 5, branchId: 'b-main', witnesses: ['Priya Nair (Staff Nurse)'], anonymous: true })
    expect(await screen.findByRole('status')).toHaveTextContent('Incident INC-000001 was saved to the incident register')
    expect(await screen.findByText('Reported clinical incidents')).toBeInTheDocument()
    expect(screen.getByText(/Critical potassium result not escalated/)).toBeInTheDocument()
    expect(screen.getByText(/Anonymous \(safe harbor\)/)).toBeInTheDocument()
    expect(localStorage.getItem('incident-draft')).toBeNull()
  })
})
