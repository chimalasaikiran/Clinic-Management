import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { PatientStrip, TextArea } from '../components/parts'
import Timeline from '../components/Timeline'
import { formatDate, formatTime } from '../format'

function Section({ title, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-brand uppercase">{title}</h3>
      {children}
    </section>
  )
}

// Pharmacy steps after signing; there is no pharmacy module yet, so a signed prescription stops at "Authorized".
const PROGRESS = ['Created', 'Authorized', 'Acknowledged', 'Dispensed', 'Collected']

export function PrescriptionDetailDrawer({ rx, patient, onClose, onOpenActivity, onDiscontinue }) {
  const [stopping, setStopping] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  if (!rx) return null
  const dispensed = rx.items.filter((item) => item.dispensing.state === 'Dispensed').length
  // Created and authorized once signed; a dispensing at the pharmacy acknowledges it, and the last line dispensed completes it.
  const reached = dispensed === rx.items.length ? 4 : rx.items.some((item) => item.dispensing.state !== 'Awaiting' && item.dispensing.state !== 'Not dispensed') ? 3 : 2

  const discontinue = async () => {
    if (reason.trim().length < 10) return setError('Give the reason for discontinuing (at least 10 characters).')
    try {
      await onDiscontinue(rx.id, reason.trim())
      setStopping(false)
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${rx.reference} · ${rx.status}`}
      title="Prescription Detail"
      description={`${rx.prescriber} · ${rx.registration} · ${formatDate(rx.date)}, ${formatTime(rx.time)}`}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={onOpenActivity}>Audit Ledger</ActionButton>
          <div className="flex gap-2">{onDiscontinue && rx.status === 'Active' && <ActionButton variant="danger" onClick={() => (stopping ? discontinue() : setStopping(true))}>{stopping ? 'Confirm Discontinue' : 'Discontinue'}</ActionButton>}<ActionButton onClick={() => window.print()}>Print</ActionButton><ActionButton variant="primary" onClick={onClose}>Close (Esc)</ActionButton></div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <PatientStrip patient={patient} />
        <Section title="Prescription summary">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-outline">Originating encounter</dt><dd className="font-semibold">{rx.encounterReference ?? 'Standalone'}</dd></div>
            <div><dt className="text-outline">Primary clinical indication</dt><dd className="font-semibold">{rx.indication}</dd></div>
            <div><dt className="text-outline">Facility branch & dispensing policy</dt><dd className="font-semibold">{rx.branch} · generic substitution permitted</dd></div>
            <div><dt className="text-outline">Content hash (SHA-256)</dt><dd className="font-mono text-[11px] font-semibold">{rx.hash}</dd></div>
          </dl>
        </Section>
        <Section title={`Prescribed line items (${rx.items.length})`}>
          <ol className="flex flex-col gap-3">
            {rx.items.map((item, index) => (
              <li key={item.id} className="rounded-md border border-slate-200 p-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-semibold">{String(index + 1).padStart(2, '0')} · {item.name} {item.strength}</p><span className="flex gap-1.5"><StatusPill>{item.route}</StatusPill><StatusPill tone="info">{item.frequency}</StatusPill><StatusPill>{item.durationDays} Days</StatusPill></span></div>
                <p className="mt-1 text-on-surface-variant">{item.drugClass ?? item.form} · Total quantity to dispense: <strong className="text-on-surface">{item.quantity}</strong></p>
                {item.instructions && <p className="mt-1 italic">&ldquo;{item.instructions}&rdquo;</p>}
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Pharmacy & dispensing progression">
          <ol className="grid grid-cols-5 gap-1 text-center text-[10px]">
            {PROGRESS.map((label, index) => <li key={label} className={cn('rounded border px-1 py-2', index < reached ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200 text-outline')}>{label}</li>)}
          </ol>
          <p className="mt-3 text-xs text-on-surface-variant">{dispensed} of {rx.items.length} lines dispensed · {rx.dispensing}</p>
        </Section>
        {stopping && (
          <Section title="Discontinue prescription">
            <TextArea label="Reason for discontinuing" required rows={2} value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} error={error} />
            <p className="mt-2 text-xs text-on-surface-variant">The prescription stays on record as discontinued; write a new one for any replacement.</p>
          </Section>
        )}
        {rx.replacedNote && <InfoNote tone="warning">{rx.replacedNote}</InfoNote>}
        <InfoNote><strong>Signed prescription:</strong> {rx.prescriber} · {rx.registration}. The content hash changes if any line is altered; amendments are written as a new prescription.</InfoNote>
      </div>
    </Drawer>
  )
}

const FILTERS = ['All Events', 'Authorizations', 'Transmissions', 'Dispensing']

export function PrescriptionActivityDrawer({ rx, patient, onClose }) {
  const [filter, setFilter] = useState('All Events')
  if (!rx) return null
  const matches = (event) => filter === 'All Events' || (filter === 'Authorizations' && /sign|authoriz|draft|created/i.test(event.title)) || (filter === 'Transmissions' && /transmit/i.test(event.title)) || (filter === 'Dispensing' && /pharmacy|dispens/i.test(event.title))
  const events = rx.events.filter(matches)

  return (
    <Drawer open onClose={onClose} eyebrow={`Prescription ${rx.reference}`} title="Prescription activity" description="Every action on this prescription, newest first." width="max-w-2xl" footer={<div className="flex justify-between gap-3"><ActionButton onClick={() => window.print()}>Export Audit Trail</ActionButton><ActionButton variant="primary" onClick={onClose}>Done / Return</ActionButton></div>}>
      <div className="flex flex-col gap-4 p-5">
        <PatientStrip patient={patient} />
        <div role="tablist" aria-label="Event type" className="flex flex-wrap gap-2">
          {FILTERS.map((entry) => <button key={entry} type="button" role="tab" aria-selected={filter === entry} onClick={() => setFilter(entry)} className={cn('rounded-md border px-3 py-1.5 text-xs font-medium', filter === entry ? 'border-black bg-black text-white' : 'border-slate-200')}>{entry}{entry === 'All Events' && ` (${rx.events.length})`}</button>)}
        </div>
        <InfoNote tone="brand"><strong>Append-only activity log:</strong> events are added as they happen and are never edited or deleted.</InfoNote>
        {events.length ? <Timeline events={events.map((event) => ({ time: event.time, title: event.title, detail: `${event.actor}${event.note ? ` — ${event.note}` : ''}` }))} /> : <p className="text-sm text-on-surface-variant">No events of this type were recorded for this prescription.</p>}
      </div>
    </Drawer>
  )
}
