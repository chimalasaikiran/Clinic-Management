import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { pathFor, ROUTES } from '../../../config/routes'
import { renderRoute } from '../../../test/renderRoute'

const setup = () => userEvent.setup({ delay: null })

async function fill(user, field, text) {
  await user.click(field)
  await user.clear(field)
  await user.paste(text)
}

const dialog = () => screen.getByRole('dialog')

describe('OPD schedule', () => {
  it('lays the day out by chamber and slot with figures taken from the bookings', () => {
    renderRoute(ROUTES.appointments)

    expect(screen.getByRole('heading', { name: /Appointments & OPD Schedule/ })).toBeInTheDocument()
    expect(screen.getByText('101')).toBeInTheDocument()
    expect(screen.getByText('Dr. Rahul Mehta, MD, DM')).toBeInTheDocument()
    expect(screen.getAllByText('Rajeshwar K. Sundaram')).toHaveLength(2)
    expect(screen.getByText('Ananya Sharma')).toBeInTheDocument()
    expect(screen.getAllByText('Ward round')).toHaveLength(2)
    expect(screen.getByText('/ 30 max cap')).toBeInTheDocument()
  })

  it('narrows the grid by doctor and by status, and resets', async () => {
    const user = setup()
    renderRoute(ROUTES.appointments)

    await user.selectOptions(screen.getByLabelText('Doctor'), 'ananya-rao')
    expect(screen.queryByText('Rajeshwar K. Sundaram')).not.toBeInTheDocument()
    expect(screen.getByText('Deepa R. Nair')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Status'), 'Pending Confirmation')
    expect(screen.queryByText('Deepa R. Nair')).not.toBeInTheDocument()
    expect(screen.getByText('Kavita S. Deshpande')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getAllByText('Rajeshwar K. Sundaram').length).toBeGreaterThan(0)
  })

  it('moves between days and shows a list of the same bookings', async () => {
    const user = setup()
    renderRoute(ROUTES.appointments)

    await user.click(screen.getByRole('tab', { name: 'List View (Ledger)' }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1 + 12)
    await user.click(screen.getByRole('button', { name: 'Next day' }))
    expect(screen.getByText('No appointments match the current filters for this day.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to Today' }))
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBeGreaterThan(5)
  })
})

describe('confirming a pending booking', () => {
  it('locks the slot and records the confirmation in the appointment history', async () => {
    const user = setup()
    const router = renderRoute(ROUTES.appointments)

    await user.click(screen.getByRole('button', { name: 'Verify & Confirm' }))
    expect(within(dialog()).getByRole('heading', { name: 'Confirm Appointment' })).toBeInTheDocument()
    expect(within(dialog()).getByText('Kavita S. Deshpande', { exact: false })).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('button', { name: 'Confirm Appointment' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify & Confirm' })).not.toBeInTheDocument()
    await act(() => router.navigate(pathFor(ROUTES.patientAppointments, { patientId: 'pt-000789' })))
    expect(await screen.findByText('Confirmed')).toBeInTheDocument()
  })
})

describe('walk-in patients', () => {
  it('needs a patient, a service and a complaint, then books the free slot with a token', async () => {
    const user = setup()
    renderRoute(ROUTES.appointments)

    await user.click(screen.getByRole('button', { name: 'Add Walk-In' }))
    await user.click(within(dialog()).getByRole('button', { name: /add walk-in & assign slot/i }))
    expect(within(dialog()).getByText('Search and select the patient, or register a new one first.')).toBeInTheDocument()
    expect(within(dialog()).getByText('Choose the service package.')).toBeInTheDocument()

    await fill(user, within(dialog()).getByLabelText('Search patient by name, MRN or mobile'), 'Zeeshan')
    await user.click(within(dialog()).getByRole('button', { name: /Mohammed Zeeshan/ }))
    await user.selectOptions(within(dialog()).getByLabelText(/^service package/i), 'SRV-CARD-001')
    await fill(user, within(dialog()).getByLabelText(/immediate complaint/i), 'Mild chest tightness after exertion')
    await user.click(within(dialog()).getByRole('button', { name: /add walk-in & assign slot/i }))

    expect(within(dialog()).getByText(/already has an open appointment with Dr\. Rahul Mehta at 10:00 AM today/)).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('button', { name: 'Change patient' }))
    await fill(user, within(dialog()).getByLabelText('Search patient by name, MRN or mobile'), 'Priya')
    await user.click(within(dialog()).getByRole('button', { name: /Priya Venkataraman/ }))
    await user.click(within(dialog()).getByRole('button', { name: /add walk-in & assign slot/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Priya Venkataraman is booked for 11:00 AM with Dr. Rahul Mehta · token A-19')
  })

  it('puts a walk-in into the waiting queue behind the others', async () => {
    const user = setup()
    renderRoute(ROUTES.appointments)

    await user.click(screen.getByRole('button', { name: 'Add Walk-In' }))
    await fill(user, within(dialog()).getByLabelText('Search patient by name, MRN or mobile'), 'Deepa')
    await user.click(within(dialog()).getByRole('button', { name: /Deepa R. Nair/ }))
    await user.selectOptions(within(dialog()).getByLabelText(/^service package/i), 'SRV-CARD-001')
    await fill(user, within(dialog()).getByLabelText(/immediate complaint/i), 'Palpitations since morning')
    await user.click(within(dialog()).getByRole('button', { name: 'Add to Waiting Queue Only' }))

    expect(screen.getByRole('status')).toHaveTextContent('joined the waiting queue with token W-01')
    expect(screen.getByText('Walk-in waiting queue')).toBeInTheDocument()
  })

  it('opens the walk-in form from an unallocated slot with the chamber chosen', async () => {
    const user = setup()
    renderRoute(ROUTES.appointments)

    await user.click(screen.getByRole('button', { name: /Unallocated slot.*at 11:00 AM in chamber 101/ }))
    expect(within(dialog()).getByLabelText(/consulting chamber/i)).toHaveValue('rahul-mehta')
    expect(within(dialog()).getByText(/The 11:00 AM slot in Dr\. Rahul Mehta's chamber is free/)).toBeInTheDocument()
  })
})
