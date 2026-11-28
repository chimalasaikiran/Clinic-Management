import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canOpen, homePath } from '../../../config/access'
import { pathFor, ROUTES } from '../../../config/routes'
import { authState } from '../../../test/auth'
import { dayFixture } from '../../../test/fixtures/dayApi'
import { renderRoute } from '../../../test/renderRoute'
import { appointmentsApi, clinicalApi } from '../../patients/api'
import { dashboardKind } from '../day/dayView'

const day = vi.hoisted(() => vi.fn())
vi.mock('../api', () => ({ dashboardApi: { day, overview: () => new Promise(() => {}) } }))

// The permissions of the default roles in backend/src/modules/roles/role-templates.ts.
const ROLES = {
  clinician: ['dashboard.view', 'bookings.view', 'bookings.notes', 'patients.view', 'clinical.read', 'clinical.write', 'pharmacy.view'],
  nurse: ['dashboard.view', 'bookings.view', 'bookings.notes', 'patients.view', 'clinical.read', 'clinical.vitals'],
  desk: ['dashboard.view', 'bookings.view', 'bookings.create', 'bookings.reschedule', 'bookings.cancel', 'patients.view', 'patients.create', 'patients.edit', 'staff.view', 'growth.view', 'growth.leads'],
  manager: ['dashboard.view', 'dashboard.telemetry', 'bookings.view', 'bookings.create', 'patients.view'],
  pharmacist: ['dashboard.view', 'patients.view', 'pharmacy.view', 'pharmacy.dispense', 'inventory.view', 'inventory.manage'],
  accountant: ['dashboard.view', 'patients.view', 'accounting.revenue', 'accounting.invoices', 'reports.view'],
  hr: ['dashboard.view', 'staff.view', 'staff.create', 'reports.view'],
  growth: ['growth.view', 'growth.leads', 'growth.manage'],
}
const can = (role) => (permission) => ROLES[role].includes(permission)
const auth = (role) => authState({ permissions: ROLES[role], roles: [{ id: `role-${role}`, name: role }] })
const open = (role, view = dayFixture()) => {
  day.mockResolvedValue(view)
  return renderRoute(ROUTES.dashboard, undefined, { auth: auth(role) })
}
const sidebar = () => within(screen.getAllByRole('navigation', { name: 'Primary' })[0])
const links = () => sidebar().getAllByRole('link').map((link) => link.textContent)

afterEach(() => vi.restoreAllMocks())

describe('what each role may open', () => {
  it('picks the dashboard from permissions', () => {
    const kinds = Object.fromEntries(Object.keys(ROLES).map((role) => [role, dashboardKind(can(role))]))
    expect(kinds).toMatchObject({ clinician: 'doctor', nurse: 'nurse', desk: 'reception', manager: 'overview', pharmacist: 'overview', accountant: 'overview', hr: 'overview' })
    expect(homePath(can('growth'))).toBe(ROUTES.growth)
  })

  it('guards the pages that change records, not only the sections', () => {
    const at = (route) => pathFor(route, { patientId: 'p', appointmentId: 'a', encounterId: 'e', leadId: 'l', campaignId: 'c' })
    expect(canOpen(ROUTES.patientNew, can('desk'))).toBe(true)
    expect(canOpen(ROUTES.patientNew, can('clinician'))).toBe(false)
    expect(canOpen(at(ROUTES.appointmentCheckIn), can('desk'))).toBe(true)
    expect(canOpen(at(ROUTES.appointmentCheckIn), can('nurse'))).toBe(false)
    expect(canOpen(at(ROUTES.appointmentStartEncounter), can('clinician'))).toBe(true)
    expect(canOpen(at(ROUTES.appointmentStartEncounter), can('nurse'))).toBe(false)
    expect(canOpen(at(ROUTES.encounter), can('desk'))).toBe(false)
    expect(canOpen(ROUTES.campaignNew, can('desk'))).toBe(false)
    expect(canOpen(ROUTES.campaignNew, can('growth'))).toBe(true)
    expect(canOpen(ROUTES.staffNew, can('desk'))).toBe(false)
    for (const role of ['clinician', 'nurse', 'desk', 'growth']) {
      expect(canOpen(ROUTES.payroll, can(role))).toBe(false)
      expect(canOpen(ROUTES.roles, can(role))).toBe(false)
      expect(canOpen(ROUTES.organisation, can(role))).toBe(false)
    }
    expect(canOpen(ROUTES.patients, can('growth'))).toBe(false)
  })
})

describe('desk dashboards', () => {
  it('shows a clinician their queue and only their sections', async () => {
    open('clinician')
    expect(await screen.findByRole('region', { name: 'Clinical Work Queue' })).toBeInTheDocument()
    expect(links()).toEqual(['Clinical workspace', 'Patients', 'Appointments', 'Clinical', 'Pharmacy'])
    expect(within(screen.getByRole('region', { name: 'Next Patient' })).getByRole('link', { name: 'Open Encounter' })).toHaveAttribute('href', '/patients/p-1/appointment/1/start-encounter')
    expect(screen.getByRole('region', { name: 'Pending Tasks' })).toBeInTheDocument()
  })

  it('lets reception check in and confirm, with feedback and a reload', async () => {
    const user = userEvent.setup({ delay: null })
    const checkIn = vi.spyOn(appointmentsApi, 'checkIn').mockResolvedValue({})
    vi.spyOn(appointmentsApi, 'confirm').mockRejectedValue(new Error('This appointment is cancelled, so it cannot be confirmed.'))
    open('desk', dayFixture({ clinical: false }))
    await screen.findByRole('region', { name: 'Front-desk work queue' })
    expect(links()).toEqual(['Reception Desk', 'Patients', 'Appointments', 'Staff', 'Growth'])
    expect(screen.queryByText(/vitals/i)).not.toBeInTheDocument()

    const loads = day.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Check in Nisha Patil' }))
    expect(checkIn).toHaveBeenCalledWith('2')
    expect(await screen.findByText('Nisha Patil is checked in.')).toBeInTheDocument()
    await waitFor(() => expect(day.mock.calls.length).toBeGreaterThan(loads))

    await user.click(screen.getByRole('button', { name: 'Confirm Farhan Ali' }))
    expect(await screen.findByText('This appointment is cancelled, so it cannot be confirmed.')).toBeInTheDocument()
  })

  it('lets a nurse record vitals and mark a specimen collected', async () => {
    const user = userEvent.setup({ delay: null })
    const record = vi.spyOn(clinicalApi, 'recordVitals').mockResolvedValue({})
    const collect = vi.spyOn(clinicalApi, 'collectSpecimen').mockResolvedValue({})
    open('nurse')
    const next = await screen.findByRole('region', { name: 'Next Patient to Prepare' })
    expect(links()).toEqual(['Nurse Dashboard', 'Patients', 'Appointments', 'Clinical'])

    await user.click(within(next).getByRole('button', { name: 'Record vitals' }))
    for (const [label, value] of [[/Systolic/, '120'], [/Diastolic/, '80'], [/Pulse/, '72'], [/Resp/, '16'], [/Temperature/, '98.6'], [/SpO/, '98'], [/Weight/, '60'], [/Height/, '165']]) {
      await user.type(screen.getByLabelText(label), value)
    }
    await user.click(screen.getByRole('button', { name: 'Save vitals' }))
    await waitFor(() => expect(record).toHaveBeenCalledWith('p-1', expect.objectContaining({ systolic: 120, spo2: 98, encounterId: undefined })))
    expect(await screen.findByText('Vitals saved for Kavya Nair.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Mark specimen collected/ }))
    expect(collect).toHaveBeenCalledWith('ord-1')
  })

  it('shows empty states and a retryable error', async () => {
    const user = userEvent.setup({ delay: null })
    day.mockRejectedValueOnce(new Error('Cannot reach ClinicOS.'))
    day.mockResolvedValue(dayFixture({ clinical: false, empty: true }))
    renderRoute(ROUTES.dashboard, undefined, { auth: auth('desk') })
    expect(await screen.findByText('Cannot reach ClinicOS.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('No one is waiting or expected.')).toBeInTheDocument()
    expect(screen.getByText('No activity yet.')).toBeInTheDocument()
  })

  it('refuses a page the role cannot open, even by address', async () => {
    renderRoute(ROUTES.payroll, undefined, { auth: auth('nurse') })
    expect(await screen.findByText(/access/i, { selector: 'h1, h2' })).toBeInTheDocument()
  })
})
