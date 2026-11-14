import { CheckCircle2, Printer } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { itemById } from '../../inventory/data/items'
import { formatDate, money, shortDateTime } from '../../inventory/format'
import { dispensedValue, interlocks } from '../dispensing'

// Read-only record of what was physically supplied against a prescription, line by line.
export default function DispensedRecordDrawer({ rx, records, onClose }) {
  const mine = records.filter((record) => record.rxId === rx.id)
  const supplied = mine.flatMap((record) => record.lines)
  const latest = mine[0]
  const value = mine.reduce((sum, record) => sum + dispensedValue(record), 0)
  const complete = rx.status === 'Dispensed'
  const checks = interlocks(rx, { register: true, otp: true })

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Pharmacy dispensary · Dispensing ledger · ${latest?.id ?? 'No record'}`}
      title="Dispensing Record Detail"
      description={latest ? `${complete ? 'Fully dispensed' : 'Partially dispensed'} · ${shortDateTime(latest.date, latest.time)}` : 'Nothing has been dispensed against this prescription yet.'}
      width="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ActionButton onClick={onClose}>Return to Pharmacy Workspace (Esc)</ActionButton>
          <ActionButton variant="primary" icon={Printer} onClick={() => window.print()}>Print Official Dispense Slip</ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <dl className="grid gap-4 rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs sm:grid-cols-3">
          <div><dt className="text-[10px] tracking-wide text-outline uppercase">Patient demographics</dt><dd className="mt-1 font-semibold">{rx.patient.name} <span className="font-normal text-outline">{rx.patient.age}{rx.patient.gender}</span></dd><dd className="font-mono text-outline">{rx.patient.uhid}</dd></div>
          <div><dt className="text-[10px] tracking-wide text-outline uppercase">Prescribing clinician</dt><dd className="mt-1 font-semibold">{rx.prescriber}</dd><dd className="text-outline">{rx.department}</dd></div>
          <div><dt className="text-[10px] tracking-wide text-outline uppercase">Dispensing officer &amp; node</dt><dd className="mt-1 font-semibold">{latest?.by ?? '—'}</dd><dd className="text-outline">Dispensary #01 · {latest ? shortDateTime(latest.date, latest.time) : ''}</dd></div>
        </dl>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Prescribed vs. actual dispensed comparison matrix</h3>
          <Table headings={['Prescribed intent', 'Physically supplied & verified', 'Qty']} minWidth={560} empty={supplied.length ? null : 'No supplied lines are recorded.'}>
            {rx.lines.map((line) => {
              const given = supplied.filter((entry) => entry.lineId === line.id)
              return (
                <Row key={line.id}>
                  <Cell><p className="font-semibold">{line.name}</p><p className="text-[11px] text-outline">{line.timing} · prescribed {line.qty} {line.unit}</p></Cell>
                  <Cell className="text-xs">{given.length ? given.map((entry) => <p key={entry.batchNo}><span className="font-mono font-semibold">{entry.batchNo}</span> · {entry.bin} · exp {formatDate(entry.expiry)}</p>) : <span className="text-outline">Not supplied</span>}</Cell>
                  <Cell><StatusPill tone={line.dispensed >= line.qty ? 'success' : 'warning'}>{line.dispensed}/{line.qty} {line.unit}</StatusPill></Cell>
                </Row>
              )
            })}
          </Table>
        </section>

        <section>
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">Recorded safety &amp; regulatory verification history <span className="text-[11px] font-normal text-outline">{checks.filter((entry) => entry.ok).length} / {checks.length} gates passed</span></h3>
          <ul className="flex flex-col gap-2">
            {checks.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-xs"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" /><span><strong className="block text-[13px]">{entry.title}</strong><span className="text-on-surface-variant">{entry.detail}</span></span></li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-slate-200 p-4 text-xs">
          <h3 className="mb-3 text-sm font-semibold">Financial settlement &amp; billing ledger link</h3>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-outline">Total dispensed value</dt><dd className="text-lg font-semibold">{money(value)}</dd></div>
            <div><dt className="text-outline">TPA / payer coverage</dt><dd className="font-semibold">{rx.coverage}</dd></div>
            <div><dt className="text-outline">WhatsApp reminders</dt><dd className="font-semibold">{latest?.reminders ? 'Enabled' : 'Not enabled'}</dd></div>
          </dl>
          <p className="mt-3 text-[11px] text-outline">{supplied.map((entry) => `${entry.name} × ${entry.qty} (${itemById(entry.itemId)?.price ?? 0}/unit)`).join(' · ')}</p>
        </section>
      </div>
    </Drawer>
  )
}
