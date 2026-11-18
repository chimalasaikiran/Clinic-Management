import { useState } from 'react'
import { ArrowRight, Info, ShieldCheck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import { InfoNote, SearchBox } from '../../../components/workspace/controls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { branchesApi } from '../../patients/api'
import LoadingState from '../../patients/components/LoadingState'
import { toPersonView } from '../adapters'
import { staffApi } from '../api'
import StaffNotFound from '../components/StaffNotFound'
import { validateBranchAssignment } from '../validation'

function BranchCard({ branch, selected, primary, onToggle, onPrimary }) {
  const inactive = branch.status !== 'active'
  return (
    <li className={cn('rounded-lg border bg-white p-4', selected ? 'border-brand' : 'border-slate-200', inactive && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={selected} disabled={inactive} onChange={onToggle} aria-label={branch.name} className="mt-1 size-4 accent-[#006a61]" />
          <span>
            <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-on-surface">
              {branch.name}
              <StatusPill>{branch.code}</StatusPill>
              {inactive && <StatusPill>Inactive</StatusPill>}
            </span>
            <span className="mt-1 block text-xs text-on-surface-variant">{branch.city}, {branch.state}</span>
          </span>
        </label>
        {selected && (
          <label className="flex items-center gap-2 text-xs font-medium text-on-surface">
            <input type="radio" name="primary" checked={primary} onChange={onPrimary} className="accent-[#006a61]" />
            Primary branch
          </label>
        )}
      </div>
    </li>
  )
}

export default function AssignBranchesPage() {
  const { staffId } = useParams()
  const person = useApiResource(() => staffApi.get(staffId), staffId)
  const branches = useApiResource(() => branchesApi.list(), 'branches')
  if ((person.loading && !person.data) || branches.loading) return <WorkspacePage><LoadingState label="Loading branches…" /></WorkspacePage>
  if (!person.data) return <StaffNotFound title="Assign branches" />
  return <Assignment key={person.data.id} record={person.data} branches={branches.data ?? []} />
}

function Assignment({ record, branches }) {
  const navigate = useNavigate()
  const person = toPersonView(record)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => record.branches.map((branch) => branch.id))
  const [primaryId, setPrimaryId] = useState(() => record.branches.find((branch) => branch.isPrimary)?.id ?? null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState('')

  const profilePath = pathFor(ROUTES.staffMember, { staffId: record.id })
  const primary = selectedIds.includes(primaryId) ? primaryId : selectedIds[0]
  const errors = submitted ? validateBranchAssignment({ selectedIds }) : {}
  const needle = query.trim().toLowerCase()
  const visible = branches.filter((branch) => !needle || `${branch.name} ${branch.city}`.toLowerCase().includes(needle))
  const active = branches.filter((branch) => branch.status === 'active')
  const chosen = branches.filter((branch) => selectedIds.includes(branch.id))

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))

  const save = async () => {
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validateBranchAssignment({ selectedIds })).length) return
    setSaving(true)
    try {
      await staffApi.setBranches(record.id, selectedIds, primary)
      navigate(profilePath)
    } catch (error) {
      setSaving(false)
      setFailure(error.message)
    }
  }

  return (
    <WorkspacePage>
      <div className="pb-20">
        <PageIntro title="Assign branches" description="Choose where this person works. You can add or remove facilities at any time." />

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
        </section>

        <InfoNote icon={ShieldCheck} className="mb-5">
          <strong className="text-on-surface">Branch deployment scope:</strong> assigning a branch lets attendance and leave be recorded there. It <u>does not</u> issue a login, change roles or set consulting hours; those are separate steps on the profile.
        </InfoNote>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <SearchBox value={query} onChange={setQuery} label="Filter branches" placeholder="Filter by branch name or city…" className="w-72 max-w-full" />
              <p className="text-xs text-on-surface-variant">
                <strong className="text-on-surface">{selectedIds.length} of {branches.length}</strong> branches selected
                <button type="button" onClick={() => setSelectedIds(active.map((branch) => branch.id))} className="ml-3 font-semibold text-brand hover:underline">Select all active</button>
              </p>
            </div>
            {errors.branches && <p role="alert" className="text-xs text-rose-600">{errors.branches}</p>}
            <ul className="flex flex-col gap-3">
              {visible.map((branch) => (
                <BranchCard key={branch.id} branch={branch} selected={selectedIds.includes(branch.id)} primary={primary === branch.id} onToggle={() => toggle(branch.id)} onPrimary={() => setPrimaryId(branch.id)} />
              ))}
              {visible.length === 0 && <li className="rounded-lg border border-slate-200 bg-white py-8 text-center text-sm text-on-surface-variant">No branches match your filter.</li>}
            </ul>
          </div>

          <Panel title="Deployment summary" action={<StatusPill tone="success">{chosen.length} Selected</StatusPill>}>
            <ul className="flex flex-col gap-2">
              {chosen.map((branch) => (
                <li key={branch.id} className="rounded-md border border-slate-200 bg-surface-lowest p-3 text-xs">
                  <p className="flex items-center justify-between font-semibold text-on-surface">{branch.name} <StatusPill tone={primary === branch.id ? 'brand' : 'neutral'}>{primary === branch.id ? 'Primary' : 'Secondary'}</StatusPill></p>
                  <p className="mt-1 text-on-surface-variant">{branch.city}</p>
                </li>
              ))}
              {chosen.length === 0 && <li className="text-xs text-on-surface-variant">No facility selected yet.</li>}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 lg:pl-72">
        {failure ? <p role="alert" className="text-xs text-rose-600">{failure}</p> : <p className="flex items-center gap-2 text-xs text-on-surface-variant"><Info className="size-4" aria-hidden="true" />You can change branch assignments at any time from the profile.</p>}
        <div className="flex gap-2">
          <ActionButton to={profilePath}>Skip for now</ActionButton>
          <ActionButton variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save branch assignments & view profile'} <ArrowRight className="size-3.5" aria-hidden="true" />
          </ActionButton>
        </div>
      </div>
    </WorkspacePage>
  )
}
