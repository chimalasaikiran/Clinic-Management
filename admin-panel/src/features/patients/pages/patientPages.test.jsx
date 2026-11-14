import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const ananya = { patientId: 'pt-000184' }
const appointment = { ...ananya, appointmentId: 'APT-2026-0912' }
const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.paste(text)
}

describe('patient directory', () => {
  it('lists patients and highlights Patients in the sidebar', () => {
    renderRoute(ROUTES.patients)

    expect(screen.getByRole('heading', { name: 'Patients' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^patients$/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Ananya Sharma' })).toBeInTheDocument()
  })

  it('filters by branch and by mobile number', async () => {
    const user = setup()
    renderRoute(ROUTES.patients)

    await user.selectOptions(screen.getByLabelText('Branch'), 'Metro North Clinic')
    expect(screen.getByText('Deepa R. Nair')).toBeInTheDocument()
    expect(screen.queryByText('Ananya Sharma')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset Filters' }))
    await fill(user, screen.getByLabelText('Search patients'), '98471 22934')
    expect(screen.getByText('Deepa R. Nair')).toBeInTheDocument()
    expect(screen.queryByText('Mohammed Zeeshan')).not.toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    const user = setup()
    renderRoute(ROUTES.patients)

    await fill(user, screen.getByLabelText('Search patients'), 'zzzz')
    expect(screen.getByText('No patients match your search.')).toBeInTheDocument()
  })

  it('selects every visible patient from the header checkbox', async () => {
    const user = setup()
    renderRoute(ROUTES.patients)

    await user.click(screen.getByRole('checkbox', { name: 'Select all patients' }))
    expect(screen.getByText('8 selected')).toBeInTheDocument()
  })
})

describe('register patient', () => {
  it('lists every missing required field', async () => {
    const user = setup()
    renderRoute(ROUTES.patientNew)

    await user.click(screen.getByRole('button', { name: 'Register patient' }))

    expect(screen.getByText('Enter the full legal name.')).toBeInTheDocument()
    expect(screen.getByText('Enter the primary mobile number.')).toBeInTheDocument()
    expect(screen.getByText('Enter the date of birth.')).toBeInTheDocument()
    expect(screen.getByText('Select a gender.')).toBeInTheDocument()
  })

  it('flags a duplicate mobile number and blocks registration until it is dismissed', async () => {
    const user = setup()
    renderRoute(ROUTES.patientNew)

    await fill(user, screen.getByLabelText(/primary mobile number/i), '9845211029')
    expect(screen.getByText('1 match alert')).toBeInTheDocument()
    expect(screen.getByText('PT-000184')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Register patient' }))
    expect(screen.getByText('Resolve the duplicate match before registering.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /not a duplicate/i }))
    expect(screen.getByRole('button', { name: /confirmed — not a duplicate/i })).toBeDisabled()
  })

  it('registers a patient and opens their empty hub', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.patientNew)

    await user.selectOptions(screen.getByLabelText(/title prefix/i), 'Ms.')
    await fill(user, screen.getByLabelText(/full legal name/i), 'Lakshmi Devi')
    await fill(user, screen.getByLabelText(/primary mobile number/i), '9000011122')
    await fill(user, screen.getByLabelText(/pin code/i), '500081')
    await fill(user, screen.getByLabelText(/date of birth/i), '1988-03-09')
    await user.click(screen.getByText('Female'))
    await user.click(screen.getByRole('button', { name: 'Register patient' }))

    expect(router.state.location.pathname).toBe('/patients/pt-001843')
    expect(await screen.findByRole('heading', { name: 'Lakshmi Devi' })).toBeInTheDocument()
    expect(screen.getAllByText('Nothing scheduled').length).toBeGreaterThan(0)
  })
})

describe('patient hub', () => {
  it('shows an unknown patient as not found', () => {
    renderRoute('/patients/pt-999999/appointments')
    expect(screen.getByText('Patient record not found')).toBeInTheDocument()
  })

  it('summarises the appointments from the records', () => {
    renderRoute(pathFor(ROUTES.patientAppointments, ananya))

    expect(screen.getByRole('heading', { name: 'Ananya Sharma' })).toBeInTheDocument()
    expect(screen.getByText('NEXT UPCOMING APPOINTMENT · CONFIRMED', { exact: false })).toBeInTheDocument()
    expect(screen.getAllByText('Dr. Rahul Mehta').length).toBeGreaterThan(0)
  })

  it('filters appointments by status tab', async () => {
    const user = setup()
    renderRoute(pathFor(ROUTES.patientAppointments, ananya))

    await user.click(screen.getByRole('tab', { name: /cancelled \/ no-show/i }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('Routine Hypertension Check')).toBeInTheDocument()
    expect(within(table).queryByText('Tele-Consultation')).not.toBeInTheDocument()
  })
})

describe('appointment lifecycle', () => {
  it('books an appointment into a free slot and opens its detail', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.appointmentNew, ananya))

    await user.click(screen.getByRole('button', { name: 'Confirm & Book Appointment' }))
    expect(screen.getByText('Select an available time slot.')).toBeInTheDocument()
    expect(screen.getByText('Enter the reason for the visit.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '02:00 PM available' }))
    await fill(user, screen.getByLabelText(/reason for visit/i), 'Post-CABG review')
    await user.click(screen.getByRole('button', { name: 'Confirm & Book Appointment' }))

    expect(router.state.location.pathname).toBe('/patients/pt-000184/appointment/APT-2026-0925')
    expect(await screen.findByRole('heading', { name: /consultation with dr\. rahul mehta/i })).toBeInTheDocument()
  })

  it('marks a slot already taken by the same doctor as unavailable', async () => {
    renderRoute(pathFor(ROUTES.appointmentNew, ananya))
    expect(screen.getByRole('button', { name: '03:00 PM booked' })).toBeDisabled()
  })

  it('cancels an appointment and keeps it in the history', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.appointmentCancel, appointment))

    await user.click(screen.getByRole('button', { name: 'Cancel appointment' }))
    expect(screen.getByText('Select a reason.')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /patient requested/i }))
    await fill(user, screen.getByLabelText(/operational context note/i), 'Patient called to cancel the visit.')
    await user.click(screen.getByRole('button', { name: 'Cancel appointment' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.appointment, appointment))
    expect(await screen.findByText(/Lifecycle closed — Cancelled/)).toBeInTheDocument()
  })

  it('marks a no-show with a reason', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.appointmentNoShow, appointment))

    await fill(user, screen.getByLabelText(/reception contact log/i), 'Called twice, no answer from the patient.')
    await user.click(screen.getByRole('button', { name: 'Mark as no-show' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.appointment, appointment))
    expect(await screen.findByText(/Lifecycle closed — No-show/)).toBeInTheDocument()
  })

  it('checks a patient in, then moves to the start-encounter gate', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.appointmentCheckIn, appointment))

    await user.click(screen.getByRole('button', { name: /confirm arrival/i }))
    expect(router.state.location.pathname).toBe(pathFor(ROUTES.appointment, appointment))
    expect(await screen.findByText('Arrived', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /start encounter/i }).length).toBeGreaterThan(0)
  })

  it('refuses to start an encounter before the patient has arrived', () => {
    renderRoute(pathFor(ROUTES.appointmentStartEncounter, appointment))

    expect(screen.getByText(/Patient not arrived/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /start encounter & open/i })).not.toBeInTheDocument()
  })

  it('reschedules into a later date and slot', async () => {
    const user = setup()
    const router = renderRoute(pathFor(ROUTES.appointmentReschedule, appointment))

    await user.click(screen.getByRole('button', { name: /^13 October 2026/ }))
    await user.click(screen.getByRole('button', { name: '09:00 AM available' }))
    await user.click(screen.getByRole('radio', { name: /patient requested/i }))
    await fill(user, screen.getByLabelText(/operational context note/i), 'Patient asked for a later day.')
    await user.click(screen.getByRole('button', { name: 'Confirm reschedule' }))

    expect(router.state.location.pathname).toBe(pathFor(ROUTES.appointment, appointment))
    expect(await screen.findByText(/Rescheduled from 12 Oct 2026/)).toBeInTheDocument()
  })

  it('shows a missing appointment as not found', () => {
    renderRoute('/patients/pt-000184/appointment/APT-0000/check-in')
    expect(screen.getByText('This appointment could not be found')).toBeInTheDocument()
  })
})

describe('encounter workspace', () => {
  async function startEncounter(user) {
    const router = renderRoute(pathFor(ROUTES.appointmentCheckIn, appointment))
    await user.click(screen.getByRole('button', { name: /confirm arrival/i }))
    await user.click((await screen.findAllByRole('link', { name: /start encounter/i }))[0])
    await user.click(await screen.findByRole('button', { name: /start encounter & open clinical workspace/i }))
    return router
  }

  it('turns a checked-in appointment into an open consultation', async () => {
    const user = setup()
    const router = await startEncounter(user)

    expect(router.state.location.pathname).toBe('/patients/pt-000184/encounter/ENC-2026-0895')
    expect(await screen.findByRole('heading', { name: /^consultation/i })).toBeInTheDocument()
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument()
    expect(screen.getByLabelText('Chief complaint')).toHaveValue('Post-CABG 90-day follow-up review & echocardiography evaluation')
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
    expect(within(dialog).getByText('28.6 kg/m²')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save vitals to encounter' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('152 / 96')).toBeInTheDocument()
  })

  it('will not complete without a diagnosis, then completes once one is attached', async () => {
    const user = setup()
    const router = await startEncounter(user)

    await user.click(await screen.findByRole('button', { name: 'Complete encounter' }))
    expect(screen.getByText('Attach at least one diagnosis before completing the encounter.')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /add diagnosis \/ problem/i }))
    await fill(user, await screen.findByLabelText(/standardized clinical search/i), 'hypertension')
    await user.click(await screen.findByRole('option', { name: /essential \(primary\) hypertension/i }))
    await fill(user, screen.getByLabelText(/clinical description/i), 'Persistent elevated readings on follow-up.')
    await user.click(screen.getByRole('button', { name: 'Attach Diagnosis to Encounter' }))
    expect(await screen.findByText(/Recorded by Dr\. Rahul Mehta/)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /back to encounter/i }))
    await user.click(await screen.findByRole('button', { name: 'Complete encounter' }))

    expect(router.state.location.pathname).toBe('/patients/pt-000184/encounters')
    const row = (await screen.findByText('#ENC-2026-0895')).closest('tr')
    expect(within(row).getByText(/Signed & Locked/)).toBeInTheDocument()
  })

  it('blocks a penicillin-class medication for a penicillin-allergic patient', async () => {
    const user = setup()
    await startEncounter(user)

    await user.click(await screen.findByRole('button', { name: 'Create / Edit Prescription' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add Medication' }))
    await user.selectOptions(within(dialog).getByLabelText(/drug name/i), 'amoxicillin')
    expect(within(dialog).getByText(/Contraindicated:/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Add to Prescription' }))
    expect(within(dialog).getByText('Ananya Sharma')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /remove amoxicillin/i })).not.toBeInTheDocument()
  })

  it('authorizes a prescription for a safe medication', async () => {
    const user = setup()
    await startEncounter(user)

    await user.click(await screen.findByRole('button', { name: 'Create / Edit Prescription' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Review & Authorize Prescription' }))
    expect(within(dialog).getByText('Add at least one medication before authorizing.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Add Medication' }))
    await user.selectOptions(within(dialog).getByLabelText(/drug name/i), 'paracetamol')
    await user.click(within(dialog).getByRole('button', { name: 'Add to Prescription' }))
    await user.click(within(dialog).getByRole('button', { name: 'Review & Authorize Prescription' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Paracetamol 500 mg')).toBeInTheDocument()
  })

  it('places a diagnostic order from the workspace', async () => {
    const user = setup()
    await startEncounter(user)

    await user.click(await screen.findByRole('button', { name: 'Create Lab / Imaging Order' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /review & submit order/i }))
    expect(within(dialog).getByText('Enter the clinical indication and justification.')).toBeInTheDocument()

    await fill(user, within(dialog).getByLabelText(/clinical indication/i), 'Evaluate suspected radiculopathy.')
    await user.click(within(dialog).getByRole('checkbox', { name: /fasting lipid profile/i }))
    await user.click(within(dialog).getByRole('button', { name: /review & submit order/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await screen.findAllByText('ORD-2026-1185', { exact: false })).length).toBeGreaterThan(0)
  })
})
