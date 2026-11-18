import { useState } from 'react'
import { CheckCircle2, Download, RefreshCw, Upload } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { formatDate } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, MetricStrip, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { DATE_RANGES } from '../constants'
import { useBilling } from '../context/useBilling'
import { TextInput } from '../../../components/workspace/FormControls'
import { reconRows, reconSummary } from '../financeLogic'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const TONE = { Matched: 'success', Exception: 'warning', Candidate: 'warning', Resolved: 'brand' }
const signed = (value) => (value === 0 ? '₹0' : `${value > 0 ? '+' : '−'} ${money(Math.abs(value))}`)

export default function ReconciliationPage() {
  const { exceptions, statementLines, imports, records, getPatient, scopeText, confirmLine, rejectLine } = useBilling()
  const filters = useRegisterFilters({ range: DATE_RANGES[0].id })
  const range = DATE_RANGES.find((entry) => entry.id === filters.get('range')) ?? DATE_RANGES[0]
  const sources = [...new Set(statementLines.map((line) => line.source))]
  const rows = reconRows({ lines: statementLines, exceptions, payments: records.payments }, { source: filters.get('source'), state: filters.get('match'), range })
  const [importing, setImporting] = useState(false)
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const latest = imports[0]
  const decide = async (line, confirm) => {
    setBusy(line.id)
    setActionError('')
    try {
      await (confirm ? confirmLine(line.id) : rejectLine(line.id))
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy('')
    }
  }
  const summary = reconSummary(rows)
  const state = { search: filters.search }

  const exportComparison = () => exportCsv('reconciliation.csv', [['Source', 'Reference', 'Date', 'Source amount (INR)', 'ClinicOS payment', 'ClinicOS amount (INR)', 'Difference (INR)', 'Status'], ...rows.map(({ line, clinicos, difference, state: status }) => [line.source, line.reference, line.date, line.amount, line.paymentId ?? '', clinicos ?? '', difference, status])])

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Billing & Finance' }} crumb="Billing & Finance / Reconciliation" code="BF-17 / Billing & Finance" title="Payment Reconciliation" description="Compare configured gateway and bank transactions with ClinicOS payments. Resolve exceptions without rewriting source records." actions={<><ActionButton icon={Upload} variant="brand" onClick={() => setImporting(true)}>Import statement</ActionButton><ActionButton icon={RefreshCw} disabled title="No bank or gateway connection is configured; import a statement file instead">Sync sources</ActionButton></>} scope={false}>
      <div className="mb-5 grid items-end gap-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        <FilterField label="Transaction date range" value={range.id} onChange={(value) => filters.change('range', value, DATE_RANGES[0].id)} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />
        <FilterField label="Source" value={filters.get('source')} onChange={(value) => filters.change('source', value)} options={[['', `All sources (${sources.length})`], ...sources]} />
        <FilterField label="Match status" value={filters.get('match')} onChange={(value) => filters.change('match', value)} options={[['', 'All · Matched & unmatched'], ['Matched', 'Matched'], ['Unmatched', 'Unmatched']]} />
        <p className="text-right text-[11px] text-outline">{scopeText} · INR / IST<br />Finance Manager · Reconcile & resolve enabled</p>
      </div>

      <p className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-slate-200 bg-white px-4 py-3 text-xs"><CheckCircle2 className="size-4 text-brand" aria-hidden="true" />{latest ? <><span>{latest.source} · {latest.fileName} imported {latest.when} by {latest.importedBy}</span><span className="text-outline">{latest.reference} · {latest.lineCount} new line{latest.lineCount === 1 ? '' : 's'} · {imports.length} import{imports.length === 1 ? '' : 's'} in all</span></> : <span>No statement imported yet. Use Import statement to load a bank or gateway CSV.</span>}</p>

      <MetricStrip items={[
        { label: 'Source transactions', value: money(summary.source), hint: `${rows.length} imported transactions · Selected scope` },
        { label: 'ClinicOS comparison total', value: money(summary.clinicos), hint: `${summary.linked} linked / candidate payments` },
        { label: 'Net difference', value: signed(summary.net), hint: 'Source − ClinicOS · Missing record treated as ₹0' },
        { label: 'Matched / unmatched', value: `${summary.matched} / ${summary.unmatched}`, hint: `${money(summary.matchedAmount)} matched · ${summary.exceptions} exceptions, ${summary.candidates} candidate` },
      ]} />

      <section className="mb-6 rounded-md border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-[17px] font-semibold">Transaction comparison <span className="ml-3 text-xs font-normal text-outline">{rows.length} records · Gross payment basis · Not a settlement ledger</span></h2><ActionButton icon={Download} onClick={exportComparison} disabled={rows.length === 0}>Export comparison</ActionButton></header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Source / reference', 'Date', 'Source (INR)', 'ClinicOS record', 'ClinicOS (INR)', 'Difference', 'Status / reason', 'Action'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ line, payment, clinicos, difference, state: status, exception }) => (
                <tr key={line.id} className={`border-t border-slate-100 align-middle ${status === 'Matched' ? '' : 'bg-surface-lowest'}`}>
                  <td className="px-5 py-4"><strong>{line.source}</strong><br /><span className="text-outline">{line.reference}</span></td>
                  <td className="px-5 py-4">{formatDate(line.date)}{line.time !== '—' && <><br /><span className="text-outline">{line.time} IST</span></>}</td>
                  <td className="px-5 py-4 text-sm font-semibold">{money(line.amount)}</td>
                  <td className="px-5 py-4">{line.paymentId ? <><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: line.paymentId })} state={state}>{line.paymentId}</TextLink><br /><span className="text-outline">{payment ? getPatient(payment.patientId)?.name ?? 'Patient' : 'Payment not loaded'}{status === 'Candidate' && ' · Suggested'}</span></> : <><strong>No linked record</strong><br /><span className="text-outline">Payer not identified</span></>}</td>
                  <td className="px-5 py-4">{money(clinicos)}</td>
                  <td className={`px-5 py-4 font-semibold ${difference ? 'text-danger' : 'text-outline'}`}>{signed(difference)}</td>
                  <td className="px-5 py-4"><StatusPill tone={TONE[status]}>{status === 'Candidate' ? 'Unmatched' : status}</StatusPill><br /><span className="text-[11px] text-outline">{status === 'Resolved' ? 'Exception resolved' : line.note}</span></td>
                  <td className="px-5 py-4">{exception ? <TextLink to={pathFor(ROUTES.billingException, { exceptionId: exception.id })} state={state}>{exception.id} →</TextLink> : status === 'Candidate' ? <span className="flex flex-wrap gap-1.5"><ActionButton size="sm" variant="brand" disabled={busy === line.id} onClick={() => decide(line, true)} aria-label={`Confirm match ${line.reference}`}>Confirm match</ActionButton><ActionButton size="sm" disabled={busy === line.id} onClick={() => decide(line, false)} aria-label={`Reject match ${line.reference}`}>Not this payment</ActionButton></span> : <TextLink to={line.paymentId ? pathFor(ROUTES.billingPayment, { paymentId: line.paymentId }) : ROUTES.billingPayments} state={state}>View match →</TextLink>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No transactions match these filters.</p>}
        </div>
        <p className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4 text-xs text-outline"><span>Showing {rows.length} of {statementLines.length} · Match status is separate from payment settlement status.</span></p>
      </section>

      {actionError && <Banner tone="danger" title="Not saved" className="mb-6">{actionError}</Banner>}
      <Banner tone="neutral" title="Review before matching or reconciling" className="mb-6">A suggested match (same amount and day, no shared reference) counts only once you confirm it. Amount differences require evidence and a resolution note. Resolving an exception creates an audit entry, not a payment, receipt or adjustment.</Banner>
      <GovernanceFooter code="BF-17">Source comparisons are read-only. Matching and resolution require explicit confirmation and preserve actor, timestamp, evidence and prior status in audit history.</GovernanceFooter>
      {importing && <ImportStatement onClose={() => setImporting(false)} sources={sources} />}
    </BillingFrame>
  )
}

// Upload of a bank or gateway CSV. The whole file is checked on the server and refused if any row is unreadable.
function ImportStatement({ onClose, sources }) {
  const { importStatement } = useBilling()
  const [source, setSource] = useState(sources[0] ?? '')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const submit = async () => {
    if (!source.trim()) return setError({ message: 'Name the bank or gateway this statement is from.' })
    if (!file) return setError({ message: 'Choose a CSV statement file.' })
    setSaving(true)
    setError(null)
    try {
      setResult(await importStatement({ source: source.trim(), fileName: file.name, csv: await file.text() }))
    } catch (failure) {
      setError(failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="Import statement" className="mb-6 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-[17px] font-semibold">Import a statement</h2>
      <p className="mt-1 text-xs text-outline">CSV with a header row: date, reference and amount are required; time and narration are optional. Dates as 2026-11-17 or 17/11/2026. Lines already imported from the same source are skipped.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextInput label="Source (bank or gateway)" required value={source} onChange={(event) => setSource(event.target.value)} placeholder="e.g. Current account, Card gateway" />
        <label className="text-xs font-medium text-on-surface-variant">Statement file (.csv)<input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full text-xs" /></label>
      </div>
      {error && <div role="alert" className="mt-4 rounded-md bg-rose-50 p-3 text-xs text-rose-700"><p className="font-semibold">{error.message}</p>{error.details?.length > 0 && <ul className="mt-1 list-disc pl-4">{error.details.map((detail) => <li key={`${detail.field}-${detail.issue}`}>{detail.field}: {detail.issue}</li>)}</ul>}</div>}
      {result && <p role="status" className="mt-4 rounded-md bg-teal-50 p-3 text-xs">{result.reference}: {result.imported} line{result.imported === 1 ? '' : 's'} imported ({result.matched} matched, {result.candidate} to review, {result.exception} exception{result.exception === 1 ? '' : 's'}){result.skipped ? ` · ${result.skipped} already imported and skipped` : ''}.</p>}
      <div className="mt-4 flex justify-end gap-2"><ActionButton onClick={onClose}>{result ? 'Close' : 'Cancel'}</ActionButton>{!result && <ActionButton variant="primary" disabled={saving} onClick={submit}>{saving ? 'Importing…' : 'Import statement'}</ActionButton>}</div>
    </section>
  )
}
