import { useState } from 'react'
import { AlertTriangle, Pill, Plus, Printer, ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, InfoNote, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../context/usePatient'
import CreatePrescriptionDrawer from '../drawers/CreatePrescriptionDrawer'
import { PrescriptionActivityDrawer, PrescriptionDetailDrawer } from '../drawers/PrescriptionDrawers'
import { formatDate } from '../format'
import { byNewest } from '../selectors'

const TABS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'active', label: 'Active', test: (rx) => rx.status === 'Active' },
  { id: 'completed', label: 'Completed', test: (rx) => rx.status === 'Completed' },
  { id: 'discontinued', label: 'Discontinued', test: (rx) => rx.status.startsWith('Discontinued') },
]

const rxTone = (status) => (status === 'Active' ? 'success' : status.startsWith('Discontinued') ? 'danger' : 'neutral')

export default function PrescriptionsTab() {
  const { patient, mine, add, newId } = usePatient()
  const [drawer, setDrawer] = useState(null)
  const [tab, setTab] = useState('active')
  const [query, setQuery] = useState('')
  const [doctor, setDoctor] = useState('')
  const [notice, setNotice] = useState('')
  const prescriptions = mine('prescriptions').sort(byNewest)
  const allergies = mine('allergies')
  const encounter = mine('encounters').find((entry) => entry.status === 'In Progress')
  const diagnoses = mine('diagnoses').filter((entry) => entry.encounterId === encounter?.id && entry.status === 'Active')
  const latestVitals = mine('vitals').sort(byNewest)[0]

  const activeItems = prescriptions.filter((rx) => rx.status === 'Active').flatMap((rx) => rx.items.map((item) => ({ ...item, rx })))
  const pending = activeItems.filter((item) => item.dispensing.state !== 'Dispensed')
  const exhausted = activeItems.filter((item) => item.refills === 0)
  const selected = TABS.find((entry) => entry.id === tab)
  const needle = query.trim().toLowerCase()
  const rows = prescriptions.filter((rx) => selected.test(rx) && (!doctor || rx.prescriber === doctor) && (!needle || `${rx.id} ${rx.items.map((item) => item.name).join(' ')}`.toLowerCase().includes(needle)))
  const cards = activeItems.filter((item) => !needle || item.name.toLowerCase().includes(needle))

  const authorize = (rx) => {
    const created = add('prescriptions', {
      ...rx, id: newId('RX-2026-S', 'prescriptions', 3), patientId: patient.id, encounterId: encounter?.id ?? null, prescriber: encounter?.doctor ?? 'Attending clinician', department: encounter?.department ?? 'OPD', registration: 'NMC #61820',
      branch: encounter?.branch ?? patient.branch, status: 'Active', dispensing: 'Awaiting pharmacy acknowledgement', hash: 'sha256:pending', events: [{ time: 'Just now', title: 'Prescription authorized & digitally signed', actor: encounter?.doctor ?? 'Attending clinician', note: '' }],
    })
    setNotice(`Prescription ${created.id} authorized and sent to the dispensing pharmacy.`)
  }

  const current = drawer ? prescriptions.find((rx) => rx.id === drawer.id) : null

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-2xl font-bold">Prescriptions</h2><p className="text-sm text-on-surface-variant">Authoritative medication orders, e-prescriptions, and clinical treatment instructions.</p></div>
        <div className="flex gap-2"><ActionButton icon={Printer} onClick={() => window.print()}>Batch Print Rx</ActionButton><ActionButton variant="brand" icon={Plus} onClick={() => setDrawer({ type: 'create' })}>Create prescription</ActionButton></div>
      </div>
      {notice && <InfoNote tone="brand" className="mb-4"><span role="status">{notice}</span></InfoNote>}

      <InfoNote tone={allergies.length ? 'danger' : 'neutral'} icon={allergies.length ? AlertTriangle : ShieldCheck} className="mb-5">
        <strong>Medication safety &amp; cross-reactivity engine · {allergies.length} critical alerts monitored</strong>
        <br />Allergies: {allergies.length ? allergies.map((allergy) => `${allergy.name} (${allergy.severity})`).join(' · ') : 'None documented'}
      </InfoNote>

      {prescriptions.length === 0 ? (
        <EmptyState icon={Pill} title="No prescriptions yet" action={<ActionButton variant="brand" icon={Plus} onClick={() => setDrawer({ type: 'create' })}>Create prescription</ActionButton>}>Prescriptions issued during encounters appear here with their dispensing status.</EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <FilterTabs label="Prescription status" value={tab} onChange={setTab} options={TABS.map((entry) => ({ id: entry.id, label: entry.label, count: prescriptions.filter(entry.test).length }))} />
            <div className="flex flex-wrap gap-2">
              <SearchBox value={query} onChange={setQuery} label="Filter medications" placeholder="Filter medication, Rx ID, generic…" className="w-64" />
              <FilterSelect label="Doctor" value={doctor} onChange={setDoctor} allLabel="Doctor: All Doctors" options={[...new Set(prescriptions.map((rx) => rx.prescriber))]} />
            </div>
          </div>

          <StatTiles
            className="mb-6 lg:grid-cols-5"
            items={[
              { label: 'Active medications', value: activeItems.length, hint: 'Currently prescribed' },
              { label: 'Latest Rx order', value: prescriptions[0] ? formatDate(prescriptions[0].date) : '—', hint: prescriptions[0] ? `Prescribed by ${prescriptions[0].prescriber}` : '' },
              { label: 'Dispensing status', value: `${activeItems.length - pending.length} / ${activeItems.length}`, hint: pending.length ? `${pending.length} Pending` : 'All dispensed' },
              { label: 'Refills tracked', value: activeItems.length - exhausted.length, hint: exhausted.length ? `${exhausted.length} medication at 0 refills` : 'All with refills remaining' },
              { label: 'Cryptographic sign-off', value: '100%', hint: 'DSC e-Sign PKI validated' },
            ]}
          />

          <h3 className="mb-3 flex items-center justify-between text-sm font-semibold">Active medications &amp; treatment regimen <span className="text-[11px] font-normal text-outline">Clinical orders separated from pharmacy dispensing movements</span></h3>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {cards.map((item) => {
              const waiting = item.refills === 0 && item.dispensing.state !== 'Dispensed'
              return (
                <article key={`${item.rx.id}-${item.id}`} className={cn('rounded-lg border bg-white p-4', waiting ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200')}>
                  <header className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-semibold">{item.name} <StatusPill tone="success">Active</StatusPill></p><p className="text-xs text-on-surface-variant">{item.drugClass ?? item.form}</p></div>
                    <p className="text-right text-sm font-bold">{item.strength}<span className="block text-[10px] font-normal text-outline">{item.route} Route</span></p>
                  </header>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-outline">Dosage & frequency</dt><dd className="font-semibold">{item.dose ?? `1 ${item.form}`} · {item.frequency}</dd><dd className="text-on-surface-variant">{item.frequencyNote}</dd></div>
                    <div><dt className="text-outline">Duration & refills</dt><dd className="font-semibold">{item.durationDays} Days</dd><dd className={item.refills ? 'text-brand' : 'font-semibold text-danger'}>{item.refills} Refills remaining{item.refills === 0 && ' (Needs renewal)'}</dd></div>
                  </dl>
                  <p className="mt-2 text-xs text-on-surface-variant"><span className="text-outline">Indication:</span> {item.indication}</p>
                  <p className={cn('mt-3 rounded-md p-2 text-[11px]', item.dispensing.state === 'Dispensed' ? 'bg-surface-low' : 'bg-amber-100 text-amber-900')}><strong>Dispensing status: {item.dispensing.state}</strong><br />{item.dispensing.note}</p>
                  <footer className="mt-3 flex items-center justify-between text-[11px] text-outline"><span>By: {item.rx.prescriber} · {item.rx.id}</span><span className="flex gap-3"><button type="button" onClick={() => setDrawer({ type: 'detail', id: item.rx.id })} className="font-semibold text-brand hover:underline" aria-label={`View Rx details for ${item.name}`}>View Rx details</button></span></footer>
                </article>
              )
            })}
            {cards.length === 0 && <p className="text-sm text-on-surface-variant">No active medications match.</p>}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4"><h3 className="text-sm font-semibold">Chronological prescription orders &amp; audited history</h3><p className="text-xs text-on-surface-variant">Complete longitudinal medication records, revisions, and pharmacy movements.</p></div>
            <Table headings={['Date & Rx ID', 'Medications & regimen', 'Prescriber & dept', 'Linked encounter', 'Branch', 'Prescription status', 'Dispensing status', 'Actions']} minWidth={1100} empty={rows.length ? null : 'No prescriptions match the current filters.'}>
              {rows.map((rx) => (
                <Row key={rx.id}>
                  <Cell><p className="font-semibold">{formatDate(rx.date)}</p><p className="font-mono text-[11px] text-brand">#{rx.id}</p></Cell>
                  <Cell><p className={cn('font-semibold', rx.status.startsWith('Discontinued') && 'line-through')}>{rx.items.map((item) => `${item.name} ${item.strength}`).join(' + ')}</p><p className="text-[11px] text-on-surface-variant">{rx.items.length} items · {rx.indication}</p></Cell>
                  <Cell><p className="font-medium">{rx.prescriber}</p><p className="text-[11px] text-on-surface-variant">{rx.department}</p></Cell>
                  <Cell className="font-mono text-[11px] text-brand">{rx.encounterId ? `#${rx.encounterId}` : '—'}</Cell>
                  <Cell>{rx.branch}</Cell>
                  <Cell><StatusPill tone={rxTone(rx.status)}>{rx.status}</StatusPill></Cell>
                  <Cell className="text-xs">{rx.dispensing}</Cell>
                  <Cell><span className="flex gap-2 text-xs font-semibold text-brand"><button type="button" onClick={() => setDrawer({ type: 'detail', id: rx.id })} className="hover:underline" aria-label={`Open ${rx.id}`}>Details</button><button type="button" onClick={() => setDrawer({ type: 'activity', id: rx.id })} className="hover:underline" aria-label={`Activity for ${rx.id}`}>Activity</button></span></Cell>
                </Row>
              ))}
            </Table>
            <TableFooter summary={`Showing ${rows.length} of ${prescriptions.length} recorded prescription episodes for ${patient.name}`}><span /></TableFooter>
          </div>

          <InfoNote className="mt-5"><strong>Separation of authority &amp; governance:</strong> Prescription = doctor&apos;s clinical medication order · Dispensing = pharmacy inventory lot deduction · Billing = tariff ledger settlement.</InfoNote>
        </>
      )}

      {drawer?.type === 'detail' && <PrescriptionDetailDrawer key={drawer.id} rx={current} patient={patient} onClose={() => setDrawer(null)} onOpenActivity={() => setDrawer({ type: 'activity', id: drawer.id })} />}
      {drawer?.type === 'activity' && <PrescriptionActivityDrawer key={drawer.id} rx={current} patient={patient} onClose={() => setDrawer(null)} />}
      <CreatePrescriptionDrawer open={drawer?.type === 'create'} onClose={() => setDrawer(null)} patient={patient} encounter={encounter} allergies={allergies} diagnoses={diagnoses} latestVitals={latestVitals} onAuthorize={authorize} />
    </div>
  )
}
