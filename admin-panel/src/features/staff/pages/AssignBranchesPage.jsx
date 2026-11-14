import { useState } from 'react'
import { AlertTriangle, ArrowRight, Info, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { InfoNote, SearchBox } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import StaffNotFound from '../components/StaffNotFound'
import { useStaffDirectory } from '../context/useStaffDirectory'
import { DEPLOYMENT_BRANCHES } from '../data/branches'
import { validateBranchAssignment } from '../validation'

const SELECTABLE = DEPLOYMENT_BRANCHES.filter((branch) => !branch.blocked && !branch.inactive)

function BranchCard({ branch, selected, onToggle }) {
  const disabled = Boolean(branch.blocked || branch.inactive)

  return (
    <li className={cn('rounded-lg border bg-white p-4', selected ? 'border-brand' : 'border-slate-200', branch.inactive && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} aria-label={branch.name} className="mt-1 size-4 accent-[#006a61]" />
          <span>
            <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-on-surface">
              {branch.name}
              {branch.kind && <StatusPill tone="success">{branch.kind}</StatusPill>}
              {branch.blocked && <StatusPill tone="danger"><AlertTriangle className="size-3" aria-hidden="true" />{branch.blocked}</StatusPill>}
              {branch.inactive && <StatusPill>{branch.inactive}</StatusPill>}
            </span>
            <span className="mt-1 block text-xs text-on-surface-variant">
              {branch.location} · {branch.capacity}
              {branch.state && <span className="ml-2 font-medium text-brand">● {branch.state}</span>}
            </span>
          </span>
        </label>
        {branch.blocked && (
          <ActionButton size="sm" to={ROUTES.departments}>
            Configure Department <ArrowRight className="size-3" aria-hidden="true" />
          </ActionButton>
        )}
        {branch.anchor && <StatusPill>Anchor Site</StatusPill>}
      </div>

      {branch.note && <p className="mt-3 text-xs text-on-surface-variant">{branch.note}</p>}

      {selected && !disabled && (
        <div className="mt-4 grid gap-4 rounded-md border border-slate-100 bg-surface-lowest p-3 sm:grid-cols-2">
          <div>
            <TextInput label={branch.departmentLabel} defaultValue={branch.department} />
            <p className="mt-1 text-[11px] text-outline">{branch.hint}</p>
          </div>
          <div>
            <TextInput label={branch.cadenceLabel} defaultValue={branch.cadence} />
            <p className="mt-1 text-[11px] text-brand">✓ {branch.ready}</p>
          </div>
        </div>
      )}
    </li>
  )
}

export default function AssignBranchesPage() {
  const { staffId } = useParams()
  const navigate = useNavigate()
  const { getPerson, setBranches } = useStaffDirectory()
  const person = getPerson(staffId)

  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => {
    const existing = SELECTABLE.filter((branch) => person?.branches.includes(branch.short)).map((branch) => branch.id)
    return existing.length ? existing : ['main']
  })
  const [submitted, setSubmitted] = useState(false)

  if (!person) return <StaffNotFound title="Assign branches" />

  const profilePath = pathFor(ROUTES.staffMember, { staffId })
  const errors = submitted ? validateBranchAssignment({ selectedIds }) : {}
  const needle = query.trim().toLowerCase()
  const visible = DEPLOYMENT_BRANCHES.filter((branch) => !needle || `${branch.name} ${branch.location}`.toLowerCase().includes(needle))
  const chosen = SELECTABLE.filter((branch) => selectedIds.includes(branch.id))

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  const save = () => {
    setSubmitted(true)
    if (Object.keys(validateBranchAssignment({ selectedIds })).length) return
    setBranches(staffId, chosen.map((branch) => branch.short))
    navigate(profilePath)
  }

  return (
    <WorkspacePage>
      <div className="pb-20">
        <PageIntro title="Assign branches" description="Choose where this clinician will practice and provide scheduled care. You can reconfigure or add secondary facilities at any time." />

        <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-4">
            <Avatar initials={person.initials} tone="teal" size="lg" />
            <div>
              <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-on-surface">
                {person.name}
                <StatusPill>{person.type}</StatusPill>
                <StatusPill tone="success">{person.role}</StatusPill>
              </p>
              <p className="text-xs text-on-surface-variant">
                Staff ID: <strong className="text-on-surface">{person.staffCode}</strong> · Reg: <strong className="text-on-surface">{person.registry}</strong>
              </p>
              <p className="text-xs text-on-surface-variant">Department: {person.department}</p>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant">
            Originating practice context
            <strong className="block text-on-surface">Main Surgical Pavilion · Flagship</strong>
          </p>
        </section>

        <InfoNote icon={ShieldCheck} className="mb-5">
          <strong className="text-on-surface">Branch deployment scope:</strong> Assigning a doctor to a facility registers them in the local branch roster, authorizes chamber availability, and connects them to local clinical departments. It <u>does not</u> automatically generate web portal login credentials or publish commercial billing tariffs.
        </InfoNote>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <SearchBox value={query} onChange={setQuery} label="Filter branches" placeholder="Filter by branch name or locality…" className="w-72 max-w-full" />
              <p className="text-xs text-on-surface-variant">
                <strong className="text-on-surface">{selectedIds.length} of {DEPLOYMENT_BRANCHES.length}</strong> branches selected
                <button type="button" onClick={() => setSelectedIds(SELECTABLE.map((branch) => branch.id))} className="ml-3 font-semibold text-brand hover:underline">Select all eligible</button>
              </p>
            </div>
            {errors.branches && <p role="alert" className="text-xs text-rose-600">{errors.branches}</p>}
            <ul className="flex flex-col gap-3">
              {visible.map((branch) => (
                <BranchCard key={branch.id} branch={branch} selected={selectedIds.includes(branch.id)} onToggle={() => toggle(branch.id)} />
              ))}
              {visible.length === 0 && <li className="rounded-lg border border-slate-200 bg-white py-8 text-center text-sm text-on-surface-variant">No branches match your filter.</li>}
            </ul>
          </div>

          <div className="flex flex-col gap-5">
            <Panel title="Deployment summary" subtitle="Active roster target facilities" action={<StatusPill tone="success">{chosen.length} Selected</StatusPill>}>
              <ul className="flex flex-col gap-2">
                {chosen.map((branch) => (
                  <li key={branch.id} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                    <p className="flex items-center justify-between font-semibold text-on-surface">{branch.short} <StatusPill>{branch.tag}</StatusPill></p>
                    <p className="mt-1 text-on-surface-variant">Department: {branch.department.split(' (')[0]}</p>
                    <p className="text-on-surface-variant">Role: {branch.cadence.split(' (')[0]}</p>
                  </li>
                ))}
                {chosen.length === 0 && <li className="text-xs text-on-surface-variant">No facility selected yet.</li>}
              </ul>
              <p className="mt-3 flex justify-between text-xs text-on-surface-variant">Roster synchronization <span className="font-semibold text-brand">⟳ Instant</span></p>
            </Panel>

            <Panel title="Enterprise governance notice" subtitle="Understanding downstream system impacts:">
              <ul className="space-y-3 text-xs leading-4 text-on-surface-variant">
                {[
                  ['Direct scheduling enabled', 'The doctor appears on local branch schedules for direct appointment booking.'],
                  ['No login credentials issued', 'Staff user credentials must be invited separately via Configuration → RBAC.'],
                  ['Billing tariffs unaltered', 'OPD consult fees and Cath Lab split ratios must be designated in Services & Pricing.'],
                  ['No automatic privileging', 'Prescribing narcotics or operative authorization remains subject to credentialing review.'],
                ].map(([title, detail]) => (
                  <li key={title}>
                    <strong className="block text-on-surface">{title}</strong>
                    {detail}
                  </li>
                ))}
              </ul>
            </Panel>

            <aside className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-xs">
              <span className="flex items-center gap-2 text-on-surface-variant"><Info className="size-4" aria-hidden="true" />Need multi-entity help? Operations desk Ext: 4410</span>
              <Link to={ROUTES.staffDirectory} className="font-semibold text-brand hover:underline">Guide →</Link>
            </aside>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 lg:pl-72">
        <p className="flex items-center gap-2 text-xs text-on-surface-variant"><Info className="size-4" aria-hidden="true" />Need to deploy later? You can assign or revoke branch access anytime from the Staff Directory.</p>
        <div className="flex gap-2">
          <ActionButton to={profilePath}>Skip for now</ActionButton>
          <ActionButton variant="primary" onClick={save}>
            Save branch assignments &amp; view profile <ArrowRight className="size-3.5" aria-hidden="true" />
          </ActionButton>
        </div>
      </div>
    </WorkspacePage>
  )
}
