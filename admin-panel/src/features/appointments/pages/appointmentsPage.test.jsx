import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTES } from '../../../config/routes'
import { apiPatient, apiPractitioner, createPatientsApi } from '../../../test/fixtures/patientsApi'
import { renderRoute } from '../../../test/renderRoute'
import { localToday } from '../../patients/format'

const fake = vi.hoisted(() => ({ api: null, state: null }))
vi.mock('../../patients/api', async (importOriginal) => {
  const actual = await importOriginal()
  const forward = (name) => new Proxy({}, { get: (_, method) => (...args) => fake.api[name][method](...args) })
  return { ...actual, patientsApi: forward('patientsApi'), appointmentsApi: forward('appointmentsApi'), practitionersApi: forward('practitionersApi'), branchesApi: forward('branchesApi'), clinicalApi: forward('clinicalApi') }
})

const ANANYA = apiPatient({ id: 'p-1', fullName: 'Ananya Sharma' })
const RAJESH = apiPatient({ id: 'p-2', mrn: 'PT-000002', fullName: 'Rajesh Sundaram', mobile: '9444082910' })

function install(options = {}) {
  const created = createPatientsApi({ patients: [ANANYA, RAJESH], practitioners: [apiPractitioner()], ...options })
  fake.api = created.api
  fake.state = created.state
}
const setup = () => userEvent.setup({ delay: null })

describe('OPD schedule', () => {
  beforeEach(() => install({ appointments: [{ date: localToday(), time: '09:00', status: 'pending', reason: 'Shoulder stiffness' }, { patientId: 'p-2', date: localToday(), time: '10:00', status: 'arrived', queueToken: 'A-01', reason: 'Knee review' }] }))

  it('shows today’s appointments from the API in the therapist’s column', async () => {
    renderRoute(ROUTES.appointments)
    expect(await screen.findByText('Dr. Rahul Mehta')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Ananya Sharma' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rajesh Sundaram' })).toBeInTheDocument()
    expect(screen.getByText('Main Clinic · 1 Chamber')).toBeInTheDocument()
  })

  it('confirms a pending booking through the API', async () => {
    const user = setup()
    renderRoute(ROUTES.appointments)
    await user.click(await screen.findByRole('button', { name: /verify & confirm/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm Appointment' }))

    await waitFor(() => expect(fake.state.appointments[0].status).toBe('confirmed'))
    expect(await screen.findByText('Appointment confirmed.')).toBeInTheDocument()
  })

  it('lists the day in ledger view and filters by status', async () => {
    const user = setup()
    renderRoute(ROUTES.appointments)
    await screen.findByRole('link', { name: 'Ananya Sharma' })
    await user.click(screen.getByRole('tab', { name: /list view/i }))
    await user.selectOptions(screen.getByLabelText('Status'), 'Arrived')
    await waitFor(() => expect(screen.getAllByRole('row').slice(1)).toHaveLength(1))
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Rajesh Sundaram')).toBeInTheDocument()
    expect(within(rows[0]).getByText('A-01')).toBeInTheDocument()
  })

  it('adds a walk-in to the waiting queue', async () => {
    const user = setup()
    renderRoute(ROUTES.appointments)
    await screen.findByRole('link', { name: 'Ananya Sharma' })
    await user.click(screen.getByRole('button', { name: 'Add Walk-In' }))

    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByLabelText(/search patient by name/i))
    await user.paste('Rajesh')
    await user.click(await within(drawer).findByRole('button', { name: /Rajesh Sundaram/ }))
    await user.click(within(drawer).getByLabelText(/triage \/ walk-in reason/i))
    await user.paste('Sudden lower back pain')
    await user.click(within(drawer).getByRole('button', { name: 'Add to Waiting Queue Only' }))

    expect(await screen.findByText('Rajesh Sundaram joined the waiting queue with token W-01.')).toBeInTheDocument()
    expect(fake.state.calls.find(([name]) => name === 'appointments.create')[1]).toMatchObject({ patientId: 'p-2', channel: 'walk_in', waitingQueue: true, arrivedNow: true, date: localToday() })
  })

  it('explains an empty day and links to therapist setup', async () => {
    install({ practitioners: [] })
    renderRoute(ROUTES.appointments)
    expect(await screen.findByText(/No therapist is consulting at Main Clinic/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /set up a therapist/i })[0]).toHaveAttribute('href', '/staff')
  })
})
