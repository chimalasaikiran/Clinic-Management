import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { ApiError } from '../../../lib/api'
import { apiPatient, apiPractitioner, createPatientsApi, tomorrow } from '../../../test/fixtures/patientsApi'
import { renderRoute } from '../../../test/renderRoute'
import { localToday } from '../format'

// Patients and appointments come from a faked API; encounters and allergies from the in-memory fixtures.
const fake = vi.hoisted(() => ({ api: null, state: null }))
vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal()
  const forward = (name) => new Proxy({}, { get: (_, method) => (...args) => fake.api[name][method](...args) })
  return { ...actual, patientsApi: forward('patientsApi'), appointmentsApi: forward('appointmentsApi'), practitionersApi: forward('practitionersApi'), branchesApi: forward('branchesApi'), clinicalApi: forward('clinicalApi') }
})

const ANANYA = apiPatient({ id: 'pt-000184', mrn: 'PT-000184', fullName: 'Ananya Sharma', mobile: '9845211029' })
const RAJESH = apiPatient({ id: 'pt-000219', mrn: 'PT-000219', fullName: 'Rajesh Sundaram', mobile: '9444082910', gender: 'male', homeBranch: { id: 'b-kondapur', name: 'Kondapur Clinic' } })

function install(options = {}) {
  const created = createPatientsApi({ patients: [ANANYA, RAJESH], ...options })
  fake.api = created.api
  fake.state = created.state
  return created.state
}
const calls = (name) => fake.state.calls.filter(([call]) => call === name).map(([, ...args]) => args)

beforeEach(() => install())

const setup = () => userEvent.setup({ delay: null })
// Multi-page flows wait on several API round trips; give them room when the whole suite runs in parallel.
const SLOW = { timeout: 20000 }
const ananya = { patientId: 'pt-000184' }

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

describe('patient directory', () => {
  it('lists registered patients from the API and highlights Patients in the sidebar', async () => {
    renderRoute(ROUTES.patients)

    expect(await screen.findByRole('link', { name: 'Ananya Sharma' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rajesh Sundaram' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^patients$/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText(/Showing 1–2 of 2 patients/)).toBeInTheDocument()
  })

  it('searches and filters on the server', async () => {
    const user = setup()
    renderRoute(ROUTES.patients)
    await screen.findByRole('link', { name: 'Ananya Sharma' })

    await fill(user, screen.getByLabelText('Search patients'), '94440 82910')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Ananya Sharma' })).not.toBeInTheDocument(), SLOW)
    expect(screen.getByRole('link', { name: 'Rajesh Sundaram' })).toBeInTheDocument()
    expect(calls('patients.list').at(-1)[0]).toMatchObject({ query: '94440 82910', page: 1 })

    await user.click(screen.getByRole('button', { name: 'Reset Filters' }))
    await user.selectOptions(screen.getByLabelText('Gender'), 'Female')
    await waitFor(() => expect(calls('patients.list').at(-1)[0]).toMatchObject({ gender: 'female' }), SLOW)
    expect(await screen.findByRole('link', { name: 'Ananya Sharma' })).toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    const user = setup()
    renderRoute(ROUTES.patients)
    await screen.findByRole('link', { name: 'Ananya Sharma' })
    await fill(user, screen.getByLabelText('Search patients'), 'zzzz')
    expect(await screen.findByText('No patients match your search.')).toBeInTheDocument()
  })

  it('pages through large result sets', async () => {
    install({ patients: Array.from({ length: 30 }, (_, index) => apiPatient({ id: `p-${index}`, mrn: `PT-${String(index + 1).padStart(6, '0')}`, fullName: `Patient ${String(index + 1).padStart(2, '0')}`, mobile: `98000000${String(index).padStart(2, '0')}` })) })
    const user = setup()
    renderRoute(ROUTES.patients)

    expect(await screen.findByText(/Showing 1–25 of 30 patients/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText(/Showing 26–30 of 30 patients/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Patient 30' })).toBeInTheDocument()
  })

  it('marks a patient inactive from the row menu', async () => {
    const user = setup()
    renderRoute(ROUTES.patients)
    await user.click(await screen.findByRole('button', { name: 'More actions for Ananya Sharma' }))
    await user.click(screen.getByRole('menuitem', { name: 'Mark as inactive' }))

    expect(await screen.findByText('Ananya Sharma is now inactive.')).toBeInTheDocument()
    expect(calls('patients.setStatus')).toEqual([['pt-000184', 'inactive', null]])
  })
})

describe('register patient', () => {
  async function fillRequired(user, mobile = '9876543210') {
    await user.selectOptions(screen.getByLabelText(/title prefix/i), 'Mr.')
    await fill(user, screen.getByLabelText(/full legal name/i), 'Arjun Reddy')
    await fill(user, screen.getByLabelText(/primary mobile number/i), mobile)
    await fill(user, screen.getByLabelText(/pin code/i), '500032')
    await fill(user, screen.getByLabelText(/date of birth/i), '1990-05-20')
    await user.click(screen.getByText('Male'))
  }

  it('lists every missing required field', async () => {
    const user = setup()
    renderRoute(ROUTES.patientNew)
    await user.click(await screen.findByRole('button', { name: 'Register patient' }))
    expect(screen.getByText('Choose a title.')).toBeInTheDocument()
    expect(screen.getByText('Enter the full legal name.')).toBeInTheDocument()
    expect(screen.getByText('Enter the primary mobile number.')).toBeInTheDocument()
    expect(calls('patients.create')).toHaveLength(0)
  })

  it('registers a patient with the server and opens their hub', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.patientNew)
    await within(screen.getByLabelText(/Originating registration branch/)).findByRole('option', { name: 'Main Clinic' })
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Register patient' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/patients/p-3'))
    expect(calls('patients.create')[0][0]).toMatchObject({ title: 'Mr.', fullName: 'Arjun Reddy', mobile: '9876543210', pinCode: '500032', dateOfBirth: '1990-05-20', gender: 'male', homeBranchId: 'b-main', confirmedNotDuplicate: false })
    expect(await screen.findByRole('heading', { name: 'Arjun Reddy' })).toBeInTheDocument()
    expect(screen.getByText('PT-000003')).toBeInTheDocument()
  })

  it('flags a duplicate mobile number and blocks registration until it is dismissed', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.patientNew)
    await within(screen.getByLabelText(/Originating registration branch/)).findByRole('option', { name: 'Main Clinic' })
    await fillRequired(user, '98452 11029')

    expect(await screen.findByText('1 match alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Register patient' }))
    expect(screen.getByText('Resolve the duplicate match before registering.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /not a duplicate/i }))
    await user.click(screen.getByRole('button', { name: 'Register patient' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/patients/p-3'))
    expect(calls('patients.create')[0][0].confirmedNotDuplicate).toBe(true)
  })

  it('shows server validation errors under the matching fields', async () => {
    const user = setup()
    renderRoute(ROUTES.patientNew)
    await within(screen.getByLabelText(/Originating registration branch/)).findByRole('option', { name: 'Main Clinic' })
    fake.api.patientsApi.create = async () => {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Some fields are missing or invalid.', [{ field: 'pinCode', issue: 'This PIN code is not served by the clinic.' }])
    }
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Register patient' }))
    expect(await screen.findByText('This PIN code is not served by the clinic.')).toBeInTheDocument()
    expect(screen.getByText('Some fields need attention.')).toBeInTheDocument()
  })

  it('edits a patient and sends the version it started from', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.patientEdit, ananya))
    const city = await screen.findByLabelText('City')
    expect(city).toHaveValue('Hyderabad')
    await user.clear(city)
    await user.paste('Bengaluru')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/patients/pt-000184'))
    expect(calls('patients.update')[0]).toEqual(['pt-000184', expect.objectContaining({ city: 'Bengaluru', version: 1 })])
  })
})

describe('patient hub', () => {
  it('shows an unknown patient as not found', async () => {
    renderRoute('/patients/p-missing')
    expect(await screen.findByText('Patient record not found')).toBeInTheDocument()
  })

  it('summarises the appointments from the API', async () => {
    install({ patients: [ANANYA], appointments: [{ time: '10:00', status: 'confirmed' }, { date: '2026-09-02', time: '11:00', status: 'completed' }, { date: '2026-08-02', time: '11:00', status: 'cancelled' }] })
    renderRoute(pathFor(ROUTES.patientAppointments, ananya))

    expect(await screen.findByText('Next upcoming appointment · Confirmed')).toBeInTheDocument()
    expect(screen.getByText('1 scheduled')).toBeInTheDocument()
    expect(screen.getByText('1 encounters')).toBeInTheDocument()
  })

  it('filters appointments by status tab', async () => {
    install({ patients: [ANANYA], appointments: [{ time: '10:00', status: 'confirmed' }, { date: '2026-08-02', time: '11:00', status: 'cancelled', reason: 'Hypertension check' }] })
    const user = setup()
    renderRoute(pathFor(ROUTES.patientAppointments, ananya))
    await user.click(await screen.findByRole('tab', { name: /Cancelled \/ No-show/ }))
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText('Cancelled')).toBeInTheDocument()
  })
})

describe('booking', () => {
  it('books a free slot with the selected therapist and opens the appointment', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.appointmentNew, ananya))
    expect(await screen.findByText(/Dr\. Rahul Mehta, MD/)).toBeInTheDocument()

    const days = await screen.findAllByRole('button', { name: /slots left/ })
    await user.click(days[1])
    await user.click(await screen.findByRole('button', { name: '09:30 AM available' }))
    await fill(user, screen.getByLabelText(/reason for visit/i), 'Knee pain after a fall')
    await user.click(screen.getByRole('button', { name: 'Confirm & Book Appointment' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/patients/pt-000184/appointment/a-1'))
    expect(calls('appointments.create')[0][0]).toEqual(expect.objectContaining({ patientId: 'pt-000184', practitionerId: 'dr-1', branchId: 'b-main', date: tomorrow(), time: '09:30', type: 'consultation', status: 'confirmed', reason: 'Knee pain after a fall' }))
    expect(await screen.findByRole('heading', { name: /Consultation with Dr\. Rahul Mehta/ })).toBeInTheDocument()
  })

  it('marks booked slots unavailable and explains a slot lost to another desk', async () => {
    install({ patients: [ANANYA, RAJESH], appointments: [{ patientId: 'pt-000219', time: '10:00' }] })
    const user = setup()
    renderRoute(pathFor(ROUTES.appointmentNew, ananya))
    await user.click((await screen.findAllByRole('button', { name: /slots left/ }))[1])
    expect(await screen.findByRole('button', { name: '10:00 AM booked' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '10:30 AM available' }))
    // Someone else takes the slot between listing and saving.
    fake.state.appointments.push({ ...fake.state.appointments[0], id: 'a-x', time: '10:30', date: tomorrow() })
    await fill(user, screen.getByLabelText(/reason for visit/i), 'Follow-up')
    await user.click(screen.getByRole('button', { name: 'Confirm & Book Appointment' }))
    expect(await screen.findByText('That slot has just been booked by someone else. Choose another time.')).toBeInTheDocument()
  })

  it('shows a closed branch day instead of its slots', async () => {
    install({ closures: { [`b-main:${tomorrow()}`]: 'Diwali' } })
    const user = setup()
    renderRoute(pathFor(ROUTES.appointmentNew, ananya))

    const closed = await screen.findByRole('button', { name: /Branch closed/ })
    expect(screen.getAllByRole('button', { name: /slots left|Branch closed/ }).indexOf(closed)).toBe(1)
    await user.click(closed)
    expect(screen.getByText(/The branch is closed on this day:/).parentElement).toHaveTextContent('Diwali. Choose another date.')
    expect(screen.queryByRole('button', { name: /AM available/ })).not.toBeInTheDocument()
  })

  it('explains when no therapist is set up yet', async () => {
    install({ patients: [ANANYA], practitioners: [] })
    renderRoute(pathFor(ROUTES.appointmentNew, ananya))
    expect(await screen.findByText('No therapists are taking appointments yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /set up a therapist/i })).toHaveAttribute('href', '/staff')
  })
})

describe('appointment lifecycle', () => {
  const detail = { ...ananya, appointmentId: 'a-1' }

  it('confirms a pending booking from its detail page', async () => {
    install({ patients: [ANANYA], appointments: [{ status: 'pending' }] })
    const user = setup()
    renderRoute(pathFor(ROUTES.appointment, detail))
    await user.click(await screen.findByRole('button', { name: 'Confirm appointment' }))
    expect(await screen.findByText(/^Confirmed •/)).toBeInTheDocument()
  })

  it('cancels an appointment with a reason and keeps it in the history', async () => {
    install({ patients: [ANANYA], appointments: [{}] })
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.appointmentCancel, detail))
    await user.click(await screen.findByRole('radio', { name: /patient requested/i }))
    await user.click(screen.getByRole('button', { name: 'Cancel appointment' }))
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument()

    await fill(user, screen.getByLabelText(/operational context note/i), 'Patient is travelling this week.')
    await user.click(screen.getByRole('button', { name: 'Cancel appointment' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/patients/pt-000184/appointment/a-1'))
    expect(calls('appointments.cancel')).toEqual([['a-1', 'Patient requested', 'Patient is travelling this week.']])
    expect(await screen.findByText('Lifecycle closed — Cancelled')).toBeInTheDocument()
  })

  it('reschedules into another free slot', async () => {
    install({ patients: [ANANYA], appointments: [{ time: '10:00' }] })
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.appointmentReschedule, detail))
    const day = Number(tomorrow().slice(8))
    // The day becomes selectable once its open slots have loaded; it is the appointment's current day.
    await user.click(await screen.findByRole('button', { name: new RegExp(`^${day} .*, Current$`) }))
    await user.click(await screen.findByRole('button', { name: '11:00 AM available' }))
    await user.click(screen.getByRole('radio', { name: /patient requested/i }))
    await fill(user, screen.getByLabelText(/operational context note/i), 'Patient asked for a later time.')
    await user.click(screen.getByRole('button', { name: 'Confirm reschedule' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/patients/pt-000184/appointment/a-1'))
    expect(calls('appointments.reschedule')[0]).toEqual(['a-1', { date: tomorrow(), time: '11:00', reason: 'Patient requested', note: 'Patient asked for a later time.' }])
  })

  it('only checks a patient in on the day of the appointment', async () => {
    install({ patients: [ANANYA], appointments: [{}] })
    renderRoute(pathFor(ROUTES.appointmentCheckIn, detail))
    expect(await screen.findByRole('button', { name: /confirm arrival/i })).toBeDisabled()
    expect(screen.getByText('Check-in opens on the day of the appointment')).toBeInTheDocument()
  })
})

describe('encounter workspace', { timeout: 30000 }, () => {
  beforeEach(() => install({ patients: [ANANYA], practitioners: [apiPractitioner()], appointments: [{ date: localToday(), time: '10:00', reason: 'Post-CABG 90-day follow-up review & echocardiography evaluation' }] }))

  async function startEncounter(user) {
    const router = renderRoute(pathFor(ROUTES.appointmentCheckIn, { ...ananya, appointmentId: 'a-1' }))
    await user.click(await screen.findByRole('button', { name: /confirm arrival/i }, SLOW))
    await user.click((await screen.findAllByRole('link', { name: /start encounter/i }, SLOW))[0])
    await user.click(await screen.findByRole('button', { name: /start encounter & open clinical workspace/i }, SLOW))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/encounter\//), SLOW)
    return router
  }

  it('turns a checked-in appointment into an open consultation', async () => {
    const user = setup()
    const router = await startEncounter(user)

    expect(router.state.location.pathname).toMatch(/^\/patients\/pt-000184\/encounter\/enc-\d+$/)
    expect(await screen.findByRole('heading', { name: /^consultation/i })).toBeInTheDocument()
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument()
    expect(screen.getByLabelText('Chief complaint')).toHaveValue('Post-CABG 90-day follow-up review & echocardiography evaluation')
    expect(fake.state.appointments[0].status).toBe('in_progress')
  })

  it('records vitals and flags a hypertensive reading', async () => {
    const user = setup()
    await startEncounter(user)

    await user.click(await screen.findByRole('button', { name: /record \/ update vitals/i }))
    await user.click(screen.getByRole('button', { name: 'Save vitals to encounter' }))
    expect(screen.getByText('Enter systolic between 50 and 300.')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    for (const [label, value] of [[/systolic/i, '152'], [/diastolic/i, '96'], [/pulse rate/i, '82'], [/resp\. rate/i, '18'], [/temperature/i, '98.6'], [/spo/i, '97'], [/weight/i, '84.5'], [/height/i, '172']]) {
      await fill(user, within(dialog).getByLabelText(label), value)
    }
    expect(within(dialog).getByText(/Stage 2 Hypertension range detected/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save vitals to encounter' }))
    expect(await screen.findByText('152 / 96')).toBeInTheDocument()
  })

  it('will not complete without a diagnosis, then completes the visit in the database too', async () => {
    const user = setup()
    const router = await startEncounter(user)

    await user.click(await screen.findByRole('button', { name: 'Complete encounter' }))
    expect(screen.getByText('Attach at least one diagnosis before completing the encounter.')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /add diagnosis \/ problem/i }))
    await fill(user, await screen.findByLabelText(/standardized clinical search/i), 'hypertension')
    await user.click(await screen.findByRole('option', { name: /essential \(primary\) hypertension/i }))
    await fill(user, screen.getByLabelText(/clinical description/i), 'Persistent elevated readings on follow-up.')
    await user.click(screen.getByRole('button', { name: 'Attach Diagnosis to Encounter' }))
    await user.click(await screen.findByRole('link', { name: /back to encounter/i }))
    await user.click(await screen.findByRole('button', { name: 'Complete encounter' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/patients/pt-000184/encounters'))
    await waitFor(() => expect(fake.state.appointments[0].status).toBe('completed'))
  })

  it('blocks a penicillin-class medication for a penicillin-allergic patient', async () => {
    const user = setup()
    await startEncounter(user)

    await user.click(await screen.findByRole('button', { name: 'Create / Edit Prescription' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add Medication' }))
    await user.selectOptions(within(dialog).getByLabelText(/drug name/i), 'amoxicillin')
    expect(within(dialog).getByText(/Contraindicated:/)).toBeInTheDocument()
  })
})
