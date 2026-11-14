import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const ananya = { staffId: 'ananya-rao' }
const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

describe('staff directory', () => {
  it('highlights Staff in the sidebar and lists the workforce', () => {
    renderRoute(ROUTES.staffDirectory)

    expect(screen.getByRole('heading', { name: 'Staff & doctors' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^staff$/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Dr. Julian Vance, MD, MCh')).toBeInTheDocument()
  })

  it('filters by type and clears with Reset', async () => {
    const user = setup()
    renderRoute(ROUTES.staffDirectory)

    await user.selectOptions(screen.getByLabelText('Type'), 'Staff')
    expect(screen.queryByText('Dr. Julian Vance, MD, MCh')).not.toBeInTheDocument()
    expect(screen.getByText('Priya Sharma, B.Sc Nursing')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByText('Dr. Julian Vance, MD, MCh')).toBeInTheDocument()
  })

  it('searches by staff ID and shows an empty state', async () => {
    const user = setup()
    renderRoute(ROUTES.staffDirectory)

    await user.type(screen.getByLabelText('Search staff'), 'STF-045')
    expect(screen.getByText('Dr. Kavita Deshmukh, MD (Paed)')).toBeInTheDocument()
    expect(screen.queryByText('Rahul Kumar')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Search staff'), 'zzz')
    expect(screen.getByText('No people match your filters.')).toBeInTheDocument()
  })

  it('opens a profile from a row', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.staffDirectory)

    await user.click(screen.getAllByRole('link', { name: 'Profile' })[1])
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.staffMember, ananya))
  })
})

describe('add person to branch assignment to profile', () => {
  it('requires the doctor credentials before creating a record', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.staffNew)

    await user.click(screen.getByRole('button', { name: /create person/i }))
    expect(screen.getByText('Enter the full name.')).toBeInTheDocument()
    expect(screen.getByText('Choose the medical council.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one qualification.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(ROUTES.staffNew)
  })

  it('creates a person, assigns branches and lands on their profile', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.staffNew)

    await fill(user, screen.getByLabelText(/Full name/), 'Dr. Sarita V. Nambiar')
    await user.selectOptions(screen.getByLabelText(/Primary department/), 'Cardiology & Vascular')
    await fill(user, screen.getByLabelText(/Professional title/), 'Senior Consultant Interventional Cardiologist')
    await user.selectOptions(screen.getByLabelText(/Medical council/), 'National Medical Commission (NMC)')
    await fill(user, screen.getByLabelText(/Council registration number/), 'NMC-TS-2016-89412')
    await user.type(screen.getByLabelText('Add qualification'), 'MBBS{Enter}')
    await user.click(screen.getByRole('button', { name: 'Create person & assign branches' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.staffBranches, { staffId: 'dr-sarita-v-nambiar' }))
    expect(screen.getByText('Dr. Sarita V. Nambiar')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Kondapur Surgical Clinic' }))
    expect(screen.getByText('2 Selected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Save branch assignments/ }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.staffMember, { staffId: 'dr-sarita-v-nambiar' }))
    expect(screen.getByRole('heading', { name: /Dr. Sarita V. Nambiar/ })).toBeInTheDocument()
    expect(screen.getByText('Main Surgical Pavilion, Kondapur Surgical Clinic')).toBeInTheDocument()
  })

  it('goes back to the directory when branch assignment is skipped', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.staffNew)

    await fill(user, screen.getByLabelText(/Full name/), 'Meera Joseph')
    await user.click(screen.getByRole('radio', { name: /Staff/ }))
    await user.selectOptions(screen.getByLabelText(/Primary department/), 'Clinical Nursing & ICU')
    await fill(user, screen.getByLabelText(/Professional title/), 'Staff Nurse')
    await user.click(screen.getByRole('checkbox', { name: /Proceed directly to Branch Assignment/ }))
    await user.click(screen.getByRole('button', { name: 'Create person' }))

    expect(router.state.location.pathname).toBe(ROUTES.staffDirectory)
    expect(screen.getByText('Meera Joseph')).toBeInTheDocument()
  })

  it('needs at least one branch before saving assignments', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.staffBranches, ananya))

    await user.click(screen.getByRole('checkbox', { name: 'Main Surgical Pavilion (Flagship)' }))
    await user.click(screen.getByRole('button', { name: /Save branch assignments/ }))
    expect(screen.getByText('Select at least one facility to deploy to.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.staffBranches, ananya))
  })

  it('does not let blocked or inactive facilities be selected', () => {
    renderRoute(pathFor(ROUTES.staffBranches, ananya))
    expect(screen.getByRole('checkbox', { name: 'Metro North Diagnostic & Day Care' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Gachibowli Satellite Annex (Upcoming)' })).toBeDisabled()
  })

  it('shows not-found for an unknown person', () => {
    renderRoute(pathFor(ROUTES.staffBranches, { staffId: 'nobody' }))
    expect(screen.getByText(/could not find this person/i)).toBeInTheDocument()
  })
})

describe('staff profile hub', () => {
  it('links every workforce section to its page', () => {
    renderRoute(pathFor(ROUTES.staffMember, ananya))

    const nav = screen.getByRole('heading', { name: 'Workforce management' }).closest('section')
    expect(within(nav).getByRole('link', { name: /Branch Assignments/ })).toHaveAttribute('href', pathFor(ROUTES.staffBranches, ananya))
    expect(within(nav).getByRole('link', { name: /User Account/ })).toHaveAttribute('href', pathFor(ROUTES.staffAccount, ananya))
    expect(within(nav).getByRole('link', { name: /OPD Schedule/ })).toHaveAttribute('href', pathFor(ROUTES.staffSchedule, ananya))
    expect(within(nav).getByRole('link', { name: /Leave & Availability/ })).toHaveAttribute('href', pathFor(ROUTES.staffLeave, ananya))
    expect(within(nav).getByRole('link', { name: /Attendance & Records/ })).toHaveAttribute('href', pathFor(ROUTES.staffAttendance, ananya))
  })
})

describe('user account setup', () => {
  it('validates the mobile number and returns to the profile once provisioned', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.staffAccount, ananya))

    const mobile = screen.getByLabelText(/Mobile number/)
    await user.clear(mobile)
    await user.click(screen.getByRole('button', { name: /Provision Account/ }))
    expect(screen.getByText('Enter the mobile number for 2FA.')).toBeInTheDocument()

    await fill(user, mobile, '9845277102')
    await user.click(screen.getByRole('button', { name: /Provision Account/ }))
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.staffMember, ananya))
  })

  it('swaps the delivery details between invitation and passcode', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.staffAccount, ananya))

    expect(screen.getByText('72 hours (auto-revoking token)')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Direct temporary administrative passcode/ }))
    expect(screen.getByLabelText('Generated temporary passcode')).toBeInTheDocument()
    expect(screen.queryByText('72 hours (auto-revoking token)')).not.toBeInTheDocument()
  })
})

describe('OPD schedule', () => {
  it('toggles days, adds a session and saves back to the profile', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.staffSchedule, ananya))

    const sunday = screen.getByRole('switch', { name: 'Sunday OPD' })
    expect(sunday).not.toBeChecked()
    await user.click(sunday)
    expect(sunday).toBeChecked()
    expect(screen.getByText('Unsaved schedule changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Save & Apply OPD Schedule/ }))
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.staffMember, ananya))
  })

  it('only offers schedule data for the connected doctor', () => {
    renderRoute(pathFor(ROUTES.staffSchedule, { staffId: 'priya-sharma' }))
    expect(screen.getByText(/connected for Dr. Ananya Rao only/i)).toBeInTheDocument()
  })
})

describe('leave & availability', () => {
  it('validates dates and reason, then adds and removes an exception', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.staffLeave, ananya))

    await user.click(screen.getByRole('button', { name: 'Add Leave / Exception' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: /Commit Exception/ }))
    expect(within(drawer).getByText('Pick a start date.')).toBeInTheDocument()
    expect(within(drawer).getByText('Add an operational justification.')).toBeInTheDocument()

    await fill(user, within(drawer).getByLabelText(/Start date/), '2026-12-24')
    await fill(user, within(drawer).getByLabelText(/End date/), '2026-12-23')
    await fill(user, within(drawer).getByLabelText(/Reason/), 'Family function')
    await user.click(within(drawer).getByRole('button', { name: /Commit Exception/ }))
    expect(within(drawer).getByText('End date cannot be before the start date.')).toBeInTheDocument()

    await user.clear(within(drawer).getByLabelText(/End date/))
    await fill(user, within(drawer).getByLabelText(/End date/), '2026-12-26')
    await user.click(within(drawer).getByRole('button', { name: /Commit Exception/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Family function')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Remove Planned Leave on 24 Dec 2026/ }))
    expect(screen.queryByText('Family function')).not.toBeInTheDocument()
  })

  it('filters exceptions by branch scope', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.staffLeave, ananya))

    await user.click(screen.getByRole('tab', { name: 'Kondapur Only' }))
    expect(screen.getByText(/Cardiological Society of India/)).toBeInTheDocument()
    expect(screen.queryByText('Scheduled Inpatient Cath Lab Block')).not.toBeInTheDocument()
  })

  it('links back to the profile and the OPD schedule', () => {
    renderRoute(pathFor(ROUTES.staffLeave, ananya))
    expect(screen.getByRole('link', { name: 'Dr. Ananya Rao' })).toHaveAttribute('href', pathFor(ROUTES.staffMember, ananya))
    expect(screen.getByRole('link', { name: /View OPD Schedule/ })).toHaveAttribute('href', pathFor(ROUTES.staffSchedule, ananya))
  })
})

describe('attendance & work records', () => {
  const path = pathFor(ROUTES.staffAttendance, ananya)

  it('records attendance and updates the summary', async () => {
    const user = setup()
    renderRoute(path)

    const presentTile = screen.getByText('Present', { selector: 'dt' }).parentElement
    expect(within(presentTile).getByText('18')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Record Attendance' }))
    const drawer = screen.getByRole('dialog')
    await user.click(within(drawer).getByRole('button', { name: 'Save Attendance' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(presentTile).getByText('19')).toBeInTheDocument()
  })

  it('requires an arrival time for present or late entries', async () => {
    const user = setup()
    renderRoute(path)

    await user.click(screen.getByRole('button', { name: 'Record Attendance' }))
    const drawer = screen.getByRole('dialog')
    await user.clear(within(drawer).getByLabelText(/Attendance time/))
    await user.click(within(drawer).getByRole('button', { name: 'Save Attendance' }))
    expect(within(drawer).getByText('Enter the arrival time.')).toBeInTheDocument()
  })

  it('opens a record, corrects it with a reason, and shows the change', async () => {
    const user = setup()
    renderRoute(path)

    await user.click(screen.getByRole('button', { name: 'View detail for 16 Oct 2026' }))
    expect(screen.getByRole('dialog', { name: 'Attendance Detail' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit / Correct Attendance' }))
    const drawer = screen.getByRole('dialog', { name: 'Edit Attendance' })
    expect(within(drawer).getByRole('button', { name: 'Save Changes (0)' })).toBeDisabled()

    await user.click(within(drawer).getByRole('button', { name: 'Late' }))
    await user.click(within(drawer).getByRole('button', { name: /Save Changes \(1\)/ }))
    expect(within(drawer).getByText(/Explain the correction/)).toBeInTheDocument()

    await fill(user, within(drawer).getByLabelText('Correction reason'), 'Biometric gate recorded early lobby entry.')
    await user.click(within(drawer).getByRole('button', { name: /Save Changes \(2\)/ }))

    expect(screen.getByRole('dialog', { name: 'Attendance Detail' })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText('Manual Entry')).toBeInTheDocument()
  })

  it('shows an empty state for a facility without sample records', async () => {
    const user = setup()
    renderRoute(path)

    await user.click(screen.getByRole('tab', { name: 'Kondapur Satellite Clinic' }))
    expect(screen.getByText(/No attendance records for Kondapur Satellite Clinic/)).toBeInTheDocument()
  })
})
