import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { PatientStrip } from '../components/parts'
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

const PROGRESS = ['Created', 'Authorized', 'Sent FHIR', 'Acknowledged', 'Staged']

export function PrescriptionDetailDrawer({ rx, patient, onClose, onOpenActivity }) {
  if (!rx) return null
  const dispensed = rx.items.filter((item) => item.dispensing.state === 'Dispensed').length
  const reached = rx.events.length ? Math.min(rx.events.length, PROGRESS.length) : 2

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${rx.id} · ${rx.status}`}
      title="Prescription Detail"
      description={`${rx.prescriber} · ${rx.registration} · ${formatDate(rx.date)}, ${formatTime(rx.time)}`}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={onOpenActivity}>Audit Ledger</ActionButton>
          <div className="flex gap-2"><ActionButton onClick={() => window.print()}>Print / Share (ABHA)</ActionButton><ActionButton variant="primary" onClick={onClose}>Close (Esc)</ActionButton></div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <PatientStrip patient={patient} />
        <Section title="Prescription summary">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-outline">Originating encounter</dt><dd className="font-semibold">{rx.encounterId ?? 'Standalone'}</dd></div>
            <div><dt className="text-outline">Primary clinical indication</dt><dd className="font-semibold">{rx.indication}</dd></div>
            <div><dt className="text-outline">Facility branch & dispensing policy</dt><dd className="font-semibold">{rx.branch} · generic substitution permitted</dd></div>
            <div><dt className="text-outline">Validity period & digital hash</dt><dd className="font-mono text-[11px] font-semibold">{rx.hash}</dd></div>
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
        {rx.replacedNote && <InfoNote tone="warning">{rx.replacedNote}</InfoNote>}
        <InfoNote><strong>Statutory prescription:</strong> digitally signed under National Medical Commission registration {rx.registration}. Subsequent amendments create new audited prescription versions.</InfoNote>
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
    <Drawer open onClose={onClose} eyebrow={`Prescription ${rx.id}`} title="Prescription activity" description="Authoritative immutable activity log & cryptographic dispatch provenance." width="max-w-2xl" footer={<div className="flex justify-between gap-3"><ActionButton onClick={() => window.print()}>Export Audit Trail</ActionButton><ActionButton variant="primary" onClick={onClose}>Done / Return</ActionButton></div>}>
      <div className="flex flex-col gap-4 p-5">
        <PatientStrip patient={patient} />
        <div role="tablist" aria-label="Event type" className="flex flex-wrap gap-2">
          {FILTERS.map((entry) => <button key={entry} type="button" role="tab" aria-selected={filter === entry} onClick={() => setFilter(entry)} className={cn('rounded-md border px-3 py-1.5 text-xs font-medium', filter === entry ? 'border-black bg-black text-white' : 'border-slate-200')}>{entry}{entry === 'All Events' && ` (${rx.events.length})`}</button>)}
        </div>
        <InfoNote tone="brand"><strong>Append-only audit ledger:</strong> historical events are cryptographically signed and cannot be edited, deleted, or backdated.</InfoNote>
        {events.length ? <Timeline events={events.map((event) => ({ time: event.time, title: event.title, detail: `${event.actor}${event.note ? ` — ${event.note}` : ''}` }))} /> : <p className="text-sm text-on-surface-variant">No events of this type were recorded for this prescription.</p>}
      </div>
    </Drawer>
  )
}
