import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { createAccessApi } from '../../../test/fixtures/accessApi'
import { apiPractitioner, createPatientsApi } from '../../../test/fixtures/patientsApi'
import { apiStaff, createStaffApi } from '../../../test/fixtures/staffApi'
import { renderRoute } from '../../../test/renderRoute'
import { localToday } from '../../patients/format'

const fake = vi.hoisted(() => ({ access: null, scheduling: null, staff: null, staffState: null, schedulingState: null }))
vi.mock('../../auth/api', () => ({
  authApi: {},
  accessApi: new Proxy({}, { get: (_, method) => (...args) => fake.access[method](...args) }),
}))
vi.mock('../../patients/api', async (importOriginal) => {
  const actual = await importOriginal()
  const forward = (name) => new Proxy({}, { get: (_, method) => (...args) => fake.scheduling[name][method](...args) })
  return { ...actual, patientsApi: forward('patientsApi'), appointmentsApi: forward('appointmentsApi'), practitionersApi: forward('practitionersApi'), branchesApi: forward('branchesApi'), clinicalApi: forward('clinicalApi') }
})
vi.mock('../api', () => ({ staffApi: new Proxy({}, { get: (_, method) => (...args) => fake.staff[method](...args) }) }))

const RAO = apiStaff()
const NURSE = apiStaff({ id: 's-2', staffCode: 'STF-002', type: 'staff', fullName: 'Priya Sharma', designation: 'Head Nurse', department: 'Clinical Nursing & ICU', council: null, councilNumber: null, qualifications: [] })
const LINKED = apiStaff({ id: 's-3', staffCode: 'STF-003', fullName: 'Dr. Rahul Mehta', account: { linked: true, membershipId: 'm-1', status: 'active', email: 'rahul@aura.test', lastLoginAt: null, roles: ['Clinician'] }, practitioner: { id: 'dr-1', status: 'active' } })

function install({ people = [RAO, NURSE, LINKED], attendance, leaves } = {}) {
  fake.access = createAccessApi()
  const scheduling = createPatientsApi({ practitioners: [apiPractitioner({ availability: [{ branchId: 'b-main', branchName: 'Main Clinic', weekday: 1, start: '09:00', end: '13:00' }] })] })
  fake.scheduling = scheduling.api
  fake.schedulingState = scheduling.state
  const staff = createStaffApi({ people, attendance, leaves })
  fake.staff = staff.api
  fake.staffState = staff.state
}
const staffCalls = (name) => fake.staffState.calls.filter(([call]) => call === name).map(([, ...args]) => args)
const schedulingCalls = (name) => fake.schedulingState.calls.filter(([call]) => call === name).map(([, ...args]) => args)

beforeEach(() => install())

const setup = () => userEvent.setup({ delay: null })
const rao = { staffId: 's-1' }

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

describe('staff directory', () => {
  it('lists the workforce from the API with real summary figures', async () => {
    renderRoute(ROUTES.staffDirectory)
    expect(await screen.findByRole('link', { name: 'Dr. Ananya Rao' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Priya Sharma' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^staff/i, current: 'page' })).toBeInTheDocument()
    expect(screen.getByText('Total people').nextElementSibling).toHaveTextContent('3')
  })

  it('filters by type and searches by staff ID on the server', async () => {
    const user = setup()
    renderRoute(ROUTES.staffDirectory)
    await screen.findByRole('link', { name: 'Priya Sharma' })

    await user.selectOptions(screen.getByLabelText('Type'), 'Staff')
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Dr. Ananya Rao' })).not.toBeInTheDocument())
    expect(staffCalls('staff.list').at(-1)[0]).toMatchObject({ type: 'staff' })

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await fill(user, screen.getByLabelText('Search staff'), 'nobody')
    expect(await screen.findByText('No people match your filters.')).toBeInTheDocument()
  })
})

describe('add person, branches and profile', () => {
  it('requires doctor credentials before creating a record', async () => {
    const user = setup()
    renderRoute(ROUTES.staffNew)
    await fill(user, screen.getByLabelText(/^Full name/), 'Dr. Kavita Deshmukh')
    await user.click(screen.getByRole('button', { name: /Create person/ }))
    expect(screen.getByText('Choose the medical council.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one qualification.')).toBeInTheDocument()
    expect(staffCalls('staff.create')).toHaveLength(0)
  })

  it('creates a staff member, assigns branches with a primary and lands on the profile', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.staffNew)
    await user.click(screen.getByRole('radio', { name: /^Staff/ }))
    await fill(user, screen.getByLabelText(/^Full name/), 'Ravi Kumar')
    await user.selectOptions(screen.getByLabelText(/Primary department/), 'Reception & Front Desk')
    await fill(user, screen.getByLabelText(/Professional title/), 'Receptionist')
    await user.click(screen.getByRole('button', { name: /Create person & assign branches/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/staff/s-4/branches'))
    expect(staffCalls('staff.create')[0][0]).toMatchObject({ type: 'staff', fullName: 'Ravi Kumar', department: 'Reception & Front Desk', designation: 'Receptionist', status: 'active' })

    await user.click(await screen.findByRole('checkbox', { name: 'Kondapur Clinic' }))
    await user.click(screen.getByRole('button', { name: /Save branch assignments/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/staff/s-4'))
    expect(staffCalls('staff.setBranches')[0]).toEqual(['s-4', ['b-kondapur'], 'b-kondapur'])
    expect(await screen.findByRole('heading', { name: /Ravi Kumar/ })).toBeInTheDocument()
  })

  it('edits details with the version it started from', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.staffEdit, rao))
    const title = await screen.findByLabelText(/Professional title/)
    await user.clear(title)
    await user.paste('Senior Consultant Cardiologist')
    await user.click(screen.getByRole('button', { name: /Save changes/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/staff/s-1'))
    expect(staffCalls('staff.update')[0]).toEqual(['s-1', expect.objectContaining({ designation: 'Senior Consultant Cardiologist', version: 1 })])
  })

  it('shows the profile built from the API', async () => {
    renderRoute(pathFor(ROUTES.staffMember, rao))
    expect(await screen.findByRole('heading', { name: /Dr. Ananya Rao/ })).toBeInTheDocument()
    expect(screen.getByText('NMC-TS-2018-49021', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Attendance records/ })).toHaveAttribute('href', '/staff/s-1/attendance')
  })

  it('needs at least one branch before saving assignments', async () => {
    install({ people: [{ ...RAO, branches: [] }] })
    const user = setup()
    renderRoute(pathFor(ROUTES.staffBranches, rao))
    await user.click(await screen.findByRole('button', { name: /Save branch assignments/ }))
    expect(screen.getByText('Select at least one facility to deploy to.')).toBeInTheDocument()
  })
})

describe('user account', () => {
  it('invites the person with a role so the login links to this record', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.staffAccount, rao))
    await screen.findByRole('option', { name: 'Front Desk & Reception' })
    await user.click(screen.getByRole('button', { name: /Send Invitation/ }))
    expect(screen.getByText('Choose the role this person will have.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^Role/), 'Front Desk & Reception')
    await user.click(screen.getByRole('button', { name: /Send Invitation/ }))
    expect(await screen.findByText('Invitation sent')).toBeInTheDocument()
    expect(staffCalls('staff.invite')[0]).toEqual(['s-1', 'a.rao@aura.test', ['front-desk']])
  })

  it('shows the linked account instead of a form for someone who already signs in', async () => {
    renderRoute(pathFor(ROUTES.staffAccount, { staffId: 's-3' }))
    expect(await screen.findByText('This person already signs in to ClinicOS.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Send Invitation/ })).not.toBeInTheDocument()
  })
})

describe('OPD schedule', () => {
  it('asks for a login before a schedule can be set up', async () => {
    renderRoute(pathFor(ROUTES.staffSchedule, rao))
    expect(await screen.findByText(/has no ClinicOS login yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Set up user account/ })).toHaveAttribute('href', '/staff/s-1/account')
  })

  it('edits the weekly hours of a linked therapist and saves them', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.staffSchedule, { staffId: 's-3' }))
    const monday = await screen.findByRole('switch', { name: 'Monday OPD' })
    expect(monday).toBeChecked()
    await user.click(screen.getByRole('switch', { name: 'Sunday OPD' }))
    await user.click(screen.getByRole('button', { name: /Save & Apply OPD Schedule/ }))

    expect(await screen.findByText('All changes saved', { exact: false })).toBeInTheDocument()
    expect(schedulingCalls('practitioners.setAvailability')[0]).toEqual(['dr-1', [
      { branchId: 'b-main', weekday: 1, start: '09:00', end: '13:00' },
      { branchId: 'b-main', weekday: 0, start: '09:00', end: '13:00' },
    ]])
  })
})

describe('leave & availability', () => {
  it('validates, adds an exception that is stored, and cancels it', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.staffLeave, rao))
    await user.click(await screen.findByRole('button', { name: 'Add Leave / Exception' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Commit exception' }))
    expect(within(drawer).getByText('Name the exception.')).toBeInTheDocument()

    await fill(user, within(drawer).getByLabelText(/^Title/), 'Cardiology conference')
    await fill(user, within(drawer).getByLabelText('Operational justification'), 'Presenting at the annual conference.')
    await user.click(within(drawer).getByRole('button', { name: 'Commit exception' }))

    expect(await screen.findByText('Exception saved. No booked appointments are affected.')).toBeInTheDocument()
    expect(staffCalls('staff.createLeave')[0][1]).toMatchObject({ kind: 'leave', title: 'Cardiology conference', startDate: localToday(), branchId: null })
    await user.click(await screen.findByRole('button', { name: 'Cancel Cardiology conference' }))
    expect(await screen.findByText('Cardiology conference cancelled; the slots are bookable again.')).toBeInTheDocument()
  })
})

describe('attendance & work records', () => {
  it('records attendance and updates the summary', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.staffAttendance, rao))
    await user.click(await screen.findByRole('button', { name: 'Record Attendance' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Save Attendance' }))
    expect(within(drawer).getByText('Enter the arrival time.')).toBeInTheDocument()

    await fill(user, within(drawer).getByLabelText(/Arrival time/), '08:52')
    await user.click(within(drawer).getByRole('button', { name: 'Save Attendance' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(staffCalls('staff.recordAttendance')[0]).toEqual(['s-1', expect.objectContaining({ branchId: 'b-main', status: 'present', time: '08:52', date: localToday() })])
    expect(await screen.findByText('08:52 AM')).toBeInTheDocument()
  })

  it('corrects a record with a reason and keeps the history', async () => {
    const today = localToday()
    install({ attendance: { 's-1': [{ id: 'att-1', date: today, status: 'present', time: '08:52', note: null, branch: { id: 'b-main', name: 'Main Clinic' }, recordedBy: 'Siddharth Verma', recordedAt: `${today}T03:30:00.000Z`, version: 1, corrections: [] }] } })
    const user = setup()
    renderRoute(pathFor(ROUTES.staffAttendance, rao))
    await user.click(await screen.findByRole('button', { name: `Correct ${today}` }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Late' }))
    await user.clear(within(drawer).getByLabelText(/Arrival time/))
    await fill(user, within(drawer).getByLabelText(/Arrival time/), '09:20')
    await user.click(within(drawer).getByRole('button', { name: /Save Changes/ }))
    expect(within(drawer).getByText(/at least 10 characters/)).toBeInTheDocument()

    await fill(user, within(drawer).getByLabelText('Correction reason'), 'Reader was down; supervisor confirmed arrival.')
    await user.click(within(drawer).getByRole('button', { name: /Save Changes/ }))
    expect(await screen.findByText('Present (08:52) → Late (09:20)')).toBeInTheDocument()
    expect(staffCalls('staff.correctAttendance')[0]).toEqual(['s-1', 'att-1', { status: 'late', time: '09:20', reason: 'Reader was down; supervisor confirmed arrival.', version: 1 }])
  })
})
