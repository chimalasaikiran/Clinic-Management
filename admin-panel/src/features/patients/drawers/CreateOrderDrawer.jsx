import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { cn } from '../../../lib/cn'
import { OptionSelect, PatientStrip, TextArea } from '../components/parts'
import { ORDER_BUNDLES, ORDER_CATALOG, ORDER_CATEGORIES, ORDER_PRIORITIES } from '../data/catalog'
import { validateOrder } from '../validation'

// Orders laboratory, imaging and special investigations. `onSubmit` receives { indication, items } and returns the API call.
export default function CreateOrderDrawer({ open, onClose, patient, encounter, diagnoses, onSubmit }) {
  const [indication, setIndication] = useState('')
  const [category, setCategory] = useState('All Enabled')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const errors = submitted ? validateOrder({ indication, items: selected }) : {}

  const needle = query.trim().toLowerCase()
  const catalog = ORDER_CATALOG.filter(
    (entry) => (category === 'All Enabled' || entry.category === category) && (!needle || `${entry.name} ${entry.code} ${entry.loinc}`.toLowerCase().includes(needle)),
  )
  const finish = () => {
    setIndication('')
    setCategory('All Enabled')
    setQuery('')
    setSelected([])
    setSubmitted(false)
    setServerError('')
    onClose()
  }
  const toggle = (code) =>
    setSelected((current) => (current.some((item) => item.code === code) ? current.filter((item) => item.code !== code) : [...current, { code, priority: ORDER_PRIORITIES[0] }]))
  const applyBundle = (bundle) => setSelected(bundle.codes.map((code) => selected.find((item) => item.code === code) ?? { code, priority: ORDER_PRIORITIES[0] }))
  const setPriority = (code, priority) => setSelected((current) => current.map((item) => (item.code === code ? { ...item, priority } : item)))

  const submit = async () => {
    setSubmitted(true)
    if (Object.keys(validateOrder({ indication, items: selected })).length) return
    const entries = selected.map((item) => ({ ...ORDER_CATALOG.find((entry) => entry.code === item.code), priority: item.priority }))
    setSaving(true)
    setServerError('')
    try {
      await onSubmit({ indication: indication.trim(), items: entries })
      finish()
    } catch (error) {
      setServerError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow={encounter ? `Encounter ${encounter.reference ?? encounter.id}` : 'Standalone order'}
      title="Create Order"
      description="Draft v1.0 (Unsubmitted) · Request diagnostic laboratory investigations & radiology imaging services."
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <ActionButton onClick={finish}>Cancel / Discard</ActionButton>
          <ActionButton variant="primary" onClick={submit} disabled={saving}>Review &amp; Submit Order ({selected.length} {selected.length === 1 ? 'Item' : 'Items'})</ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <PatientStrip patient={patient} />
        {serverError && <InfoNote tone="danger"><span role="alert">{serverError}</span></InfoNote>}

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-brand uppercase">Clinical context &amp; indication</h3>
          {diagnoses.length > 0 && (
            <div className="mb-3 rounded-md border border-slate-200 p-3 text-xs"><p className="font-semibold">{diagnoses[0].name} <span className="ml-1 rounded bg-brand px-1.5 py-0.5 text-[10px] text-white">Primary Reason</span></p><p className="font-mono text-[11px] text-on-surface-variant">ICD-10: {diagnoses[0].icd} · SNOMED CT: {diagnoses[0].snomed}</p></div>
          )}
          <TextArea label="Ordering physician clinical indication & justification" required rows={3} value={indication} onChange={(event) => setIndication(event.target.value)} error={errors.indication} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-brand uppercase">Section 1 — Order category selector</h3>
          <div role="tablist" aria-label="Order category" className="flex flex-wrap gap-2">
            {ORDER_CATEGORIES.map((entry) => (
              <button key={entry} type="button" role="tab" aria-selected={category === entry} onClick={() => setCategory(entry)} className={cn('rounded-md border px-3 py-1.5 text-xs font-medium', category === entry ? 'border-brand bg-brand text-white' : 'border-slate-200')}>
                {entry}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-brand uppercase">Section 2 — Catalogue search &amp; smart lookup</h3>
          <SearchBox value={query} onChange={setQuery} label="Search tests" placeholder="Search tests by name, LOINC, or test code (e.g. MRI Lumbar, CBC, ESR, CRP, HbA1c)…" />
          <p className="mt-3 mb-1.5 text-[11px] text-outline">Quick diagnostic protocol bundles:</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {ORDER_BUNDLES.map((bundle) => <ActionButton key={bundle.id} size="sm" onClick={() => applyBundle(bundle)}>{bundle.label}</ActionButton>)}
          </div>
          <ul className="flex flex-col gap-2">
            {catalog.map((entry) => {
              const picked = selected.some((item) => item.code === entry.code)
              return (
                <li key={entry.code}>
                  <label className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3 text-xs', picked ? 'border-brand bg-teal-50/50' : 'border-slate-200')}>
                    <input type="checkbox" checked={picked} onChange={() => toggle(entry.code)} aria-label={entry.name} className="mt-0.5 accent-[#006a61]" />
                    <span><strong className="text-[13px]">{entry.name}</strong><br /><span className="text-on-surface-variant">{entry.category} · LOINC {entry.loinc} · {entry.code}</span></span>
                  </label>
                </li>
              )
            })}
            {catalog.length === 0 && <li className="text-xs text-on-surface-variant">No investigations match the current search.</li>}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-brand uppercase">Section 3 — Selected order items ({selected.length}) {selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="text-[11px] font-medium text-danger normal-case hover:underline">Clear All</button>}</h3>
          {selected.length === 0 && <p className="text-xs text-on-surface-variant">No investigations selected yet.</p>}
          <ul className="flex flex-col gap-3">
            {selected.map((item) => {
              const entry = ORDER_CATALOG.find((candidate) => candidate.code === item.code)
              return (
                <li key={item.code} className="rounded-md border border-slate-200 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold">{entry.name}</p>
                    <button type="button" aria-label={`Remove ${entry.name}`} onClick={() => toggle(item.code)} className="text-outline hover:text-danger"><Trash2 className="size-4" aria-hidden="true" /></button>
                  </div>
                  <p className="text-on-surface-variant">LOINC: {entry.loinc} · Code: {entry.code} · Destination: {entry.destination}</p>
                  <div className="mt-2 max-w-xs"><OptionSelect label="Urgent / priority" value={item.priority} onChange={(event) => setPriority(item.code, event.target.value)} options={ORDER_PRIORITIES.map((priority) => ({ value: priority, label: priority }))} /></div>
                </li>
              )
            })}
          </ul>
          {errors.items && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.items}</p>}
        </section>

        <InfoNote tone="brand">
          <strong>Routing:</strong> the order goes to the lab or imaging queue once submitted. Laboratory orders wait for specimen collection; imaging results can be entered directly.
        </InfoNote>
      </div>
    </Drawer>
  )
}
