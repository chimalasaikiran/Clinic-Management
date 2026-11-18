import { useState } from 'react'
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import Modal from '../../../components/workspace/Modal'
import StatusPill from '../../../components/workspace/StatusPill'
import { Check } from '../../patients/components/parts'
import { TARIFF_NOTE } from '../../patients/adapters'
import { formatLongDate, formatTime, localToday } from '../../patients/format'

// Moves a pending booking to confirmed. The server checks the status change; the slot was already held when booked.
export default function ConfirmAppointmentModal({ appointment, onClose, onConfirm }) {
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    setSaving(true)
    setError('')
    try {
      await onConfirm(appointment.id, notify)
      onClose()
    } catch (failure) {
      setSaving(false)
      setError(failure.message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Appointment status transition · Lifecycle governance"
      title="Confirm Appointment"
      description={`Verify the booking and change its status from ${appointment.status} to Confirmed.`}
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Cancel &amp; Keep Pending</ActionButton><ActionButton variant="brand" icon={CheckCircle2} disabled={saving} onClick={confirm}>{saving ? 'Confirming…' : 'Confirm Appointment'}</ActionButton></div>}
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <section className="rounded-lg border border-slate-200 bg-surface-lowest p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-base font-semibold">{appointment.patientName}<StatusPill tone="warning">{appointment.status}</StatusPill></p>
              <p className="mt-1 font-mono text-[11px] text-on-surface-variant">MRN {appointment.patientMrn}</p>
            </div>
            <div className="text-right text-[11px] text-outline"><p className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-on-surface">{appointment.reference}</p><p className="mt-1">{appointment.channel}</p></div>
          </div>
          <dl className="mt-4 grid gap-4 border-t border-slate-200 pt-4 text-xs sm:grid-cols-2">
            <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Consulting clinician</dt><dd className="mt-1 text-sm font-semibold">{appointment.doctor}</dd><dd className="text-outline">{appointment.specialty} · {appointment.room}</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Facility &amp; branch</dt><dd className="mt-1 text-sm font-semibold">{appointment.branch}</dd><dd className="text-outline">{appointment.campus}</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Scheduled time slot</dt><dd className="mt-1 text-sm font-semibold">{appointment.date === localToday() ? 'Today, ' : ''}{formatLongDate(appointment.date)}</dd><dd className="font-semibold text-emerald-700">{formatTime(appointment.time)} - {formatTime(appointment.endTime)} ({appointment.minutes} min)</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Tariff &amp; billing schedule</dt><dd className="mt-1 text-sm font-semibold">{appointment.service}</dd><dd className="text-outline">{TARIFF_NOTE}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
          <p className="mb-3 flex items-center justify-between text-[10px] font-semibold tracking-wide text-outline uppercase">Atomic lifecycle transition <span className="flex items-center gap-1 font-mono font-normal text-emerald-700 normal-case"><Lock className="size-3" aria-hidden="true" />Slot already held</span></p>
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs"><strong className="block text-amber-900">● Pending Confirmation</strong><span className="text-amber-800">Tentative booking</span></p>
            <ArrowRight className="mx-auto size-4 text-outline" aria-hidden="true" />
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs"><strong className="block text-emerald-900">Confirmed</strong><span className="text-emerald-800">OPD slot locked (roster committed)</span></p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
          <Check checked={notify} onChange={(event) => setNotify(event.target.checked)} label={<><strong className="text-[13px]">Send a confirmation to the patient</strong><span className="mt-1 block text-xs text-on-surface-variant">Sent once an SMS / WhatsApp provider is connected.</span></>} />
          <p className="mt-3 border-l-2 border-slate-200 pl-3 text-[11px] text-outline"><strong>Note:</strong> notification delivery is reported independently. A dispatch failure will not reverse the confirmed slot status.</p>
        </section>

        <InfoNote><strong>Clinical policy:</strong> confirming this appointment secures the slot on {appointment.doctorShort}&apos;s roster. It does <strong>not</strong> mark the patient as arrived, generate premature queue tokens, or create billing invoices.</InfoNote>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      </div>
    </Modal>
  )
}
