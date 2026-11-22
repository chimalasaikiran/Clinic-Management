import { useState } from 'react'
import { Check } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Drawer from '../../../components/workspace/Drawer'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { staffApi } from '../../staff/api'
import { configApi } from '../api'
import { BRANCH_STATUS } from '../configView'

function Section({ number, title, aside, children }) {
  return (
    <section className="border-b border-slate-100 px-5 py-4">
      <h3 className="mb-3 flex items-center justify-between text-[11px] font-bold tracking-wide text-on-surface-variant uppercase">
        <span>
          {number}. {title}
        </span>
        {aside && <span className="text-[10px] font-medium text-brand normal-case">{aside}</span>}
      </h3>
      {children}
    </section>
  )
}

// Which branches one person works at, and which of them is their primary branch.
export default function BranchAssignmentDrawer({ open, onClose, person, onSaved }) {
  const branches = useApiResource(() => (open ? configApi.branches() : Promise.resolve(null)), `assignment-branches:${open}`).data ?? []
  const [branchIds, setBranchIds] = useState(person.branches.map((branch) => branch.id))
  const [primaryId, setPrimaryId] = useState(person.branches.find((branch) => branch.isPrimary)?.id ?? person.branches[0]?.id ?? '')
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)

  const toggle = (id) => {
    const next = branchIds.includes(id) ? branchIds.filter((value) => value !== id) : [...branchIds, id]
    setBranchIds(next)
    if (!next.includes(primaryId)) setPrimaryId(next[0] ?? '')
  }
  const finish = () => {
    setFailure('')
    onClose()
  }
  const save = async () => {
    if (!branchIds.length) return setFailure('Keep at least one branch.')
    setPending(true)
    setFailure('')
    try {
      onSaved(await staffApi.setBranches(person.id, branchIds, primaryId))
      finish()
    } catch (error) {
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Branch configuration"
      title="Branch assignment"
      footer={
        <>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="brand" icon={Check} onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</ActionButton>
          </div>
          <p className="mt-2 text-center text-[11px] text-outline">Doctors also need availability at a branch before patients can book them there.</p>
        </>
      }
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-sm font-semibold text-on-surface">
          {person.fullName} <StatusPill tone={person.status === 'active' ? 'success' : 'neutral'} className="ml-1">{person.status === 'active' ? 'Active' : person.status}</StatusPill>
        </p>
        <p className="mt-0.5 text-xs text-on-surface-variant">{[person.type === 'doctor' ? 'Doctor' : 'Staff', person.designation, person.staffCode].filter(Boolean).join(' · ')}</p>
      </div>
      {failure && <Banner tone="danger" title={failure} className="mx-5 mt-4" />}

      <Section number={1} title="Branches" aside={`${branchIds.length} selected`}>
        <ul className="flex flex-col gap-2">
          {branches.filter((branch) => branch.status !== 'inactive' || branchIds.includes(branch.id)).map((branch) => {
            const checked = branchIds.includes(branch.id)
            return (
              <li key={branch.id}>
                <label className={cn('flex cursor-pointer items-start justify-between gap-3 rounded-md border p-3', checked ? 'border-brand bg-teal-50/50' : 'border-slate-200')}>
                  <span className="flex items-start gap-2">
                    <input type="checkbox" checked={checked} onChange={() => toggle(branch.id)} aria-label={branch.name} className="mt-0.5 accent-brand" />
                    <span>
                      <span className="block text-[13px] font-semibold text-on-surface">{branch.name} ({branch.code})</span>
                      <span className="text-xs text-on-surface-variant">{branch.city}</span>
                    </span>
                  </span>
                  <StatusPill tone={BRANCH_STATUS[branch.status][1]}>{BRANCH_STATUS[branch.status][0]}</StatusPill>
                </label>
              </li>
            )
          })}
          {branches.length === 0 && <li className="text-xs text-on-surface-variant">Loading branches…</li>}
        </ul>
      </Section>

      <Section number={2} title="Primary branch">
        <select aria-label="Primary branch" value={primaryId} onChange={(event) => setPrimaryId(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px]">
          {branches.filter((branch) => branchIds.includes(branch.id)).map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
        <p className="mt-2 text-[11px] text-outline">Their department is {person.department ?? 'not set'}; change it on their staff record.</p>
      </Section>
    </Drawer>
  )
}
