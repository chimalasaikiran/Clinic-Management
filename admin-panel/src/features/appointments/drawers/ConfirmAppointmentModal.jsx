import { useState } from 'react'
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import Modal from '../../../components/workspace/Modal'
import StatusPill from '../../../components/workspace/StatusPill'
import { Check } from '../../patients/components/parts'
import { formatINR, formatLongDate, formatTime, TODAY } from '../../patients/format'
import { canConfirm } from '../logic'

// Moves a pending booking to confirmed. The slot is taken first; the notification is a separate, best-effort step.
export default function ConfirmAppointmentModal({ appointment, patient, appointments, onClose, onConfirm }) {
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState('')
  const endTime = (() => {
    const total = Number(appointment.time.slice(0, 2)) * 60 + Number(appointment.time.slice(3)) + appointment.minutes
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  })()

  const confirm = () => {
    const check = canConfirm(appointment, appointments)
    if (!check.ok) return setError(check.error)
    onConfirm(appointment.id, notify)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Appointment status transition · Lifecycle governance"
      title="Confirm Appointment"
      description={`Verify appointment eligibility and transition status from ${appointment.status} to Confirmed (Scheduled).`}
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Cancel &amp; Keep Pending</ActionButton><ActionButton variant="brand" icon={CheckCircle2} onClick={confirm}>Confirm Appointment</ActionButton></div>}
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        <section className="rounded-lg border border-slate-200 bg-surface-lowest p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-base font-semibold">{patient.name} <span className="text-xs font-normal text-on-surface-variant">({patient.age}y, {patient.gender})</span><StatusPill tone="success">ABDM Verified</StatusPill></p>
              <p className="mt-1 font-mono text-[11px] text-on-surface-variant">MRN {patient.mrn} · ABHA {patient.abha}</p>
            </div>
            <div className="text-right text-[11px] text-outline"><p className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-on-surface">#{appointment.id}</p><p className="mt-1">{appointment.mode.includes('Tele') ? 'Online Tele-Intake Portal' : appointment.channel}</p></div>
          </div>
          <dl className="mt-4 grid gap-4 border-t border-slate-200 pt-4 text-xs sm:grid-cols-2">
            <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Consulting clinician</dt><dd className="mt-1 text-sm font-semibold">{appointment.doctor}</dd><dd className="text-outline">{appointment.specialty.split(' ')[0]} · {appointment.room}</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Facility &amp; branch</dt><dd className="mt-1 text-sm font-semibold">{appointment.branch}</dd><dd className="text-outline">{appointment.campus}</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Scheduled time slot</dt><dd className="mt-1 text-sm font-semibold">{appointment.date === TODAY ? 'Today, ' : ''}{formatLongDate(appointment.date)}</dd><dd className="font-semibold text-emerald-700">{formatTime(appointment.time)} - {formatTime(endTime)} IST ({appointment.minutes} min)</dd></div>
            <div><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Tariff &amp; billing schedule</dt><dd className="mt-1 text-sm font-semibold">{appointment.service}</dd><dd className="text-outline">{formatINR(appointment.tariff)} · Payable on arrival</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
          <p className="mb-3 flex items-center justify-between text-[10px] font-semibold tracking-wide text-outline uppercase">Atomic lifecycle transition <span className="flex items-center gap-1 font-mono font-normal text-emerald-700 normal-case"><Lock className="size-3" aria-hidden="true" />Slot mutex acquired</span></p>
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs"><strong className="block text-amber-900">● Pending Confirmation</strong><span className="text-amber-800">Unverified web intake</span></p>
            <ArrowRight className="mx-auto size-4 text-outline" aria-hidden="true" />
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs"><strong className="block text-emerald-900">Confirmed</strong><span className="text-emerald-800">OPD slot locked (roster committed)</span></p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 p-4">
          <Check checked={notify} onChange={(event) => setNotify(event.target.checked)} label={<><strong className="text-[13px]">Dispatch instant WhatsApp &amp; SMS confirmation slip</strong><span className="mt-1 block text-xs text-on-surface-variant">Sends the digital booking receipt, clinic arrival instructions and chamber wayfinding to {patient.mobile}. DISHA 2024 consent on file.</span></>} />
          <p className="mt-3 border-l-2 border-slate-200 pl-3 text-[11px] text-outline"><strong>Note:</strong> notification delivery is reported independently. A dispatch failure will not reverse the confirmed slot status.</p>
        </section>

        <InfoNote><strong>Clinical policy:</strong> confirming this appointment secures the slot on {appointment.doctorShort}&apos;s roster. It does <strong>not</strong> mark the patient as arrived, generate premature queue tokens, or create billing invoices.</InfoNote>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      </div>
    </Modal>
  )
}
