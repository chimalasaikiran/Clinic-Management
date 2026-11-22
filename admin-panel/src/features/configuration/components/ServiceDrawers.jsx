import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { CheckRow, InfoNote, SearchBox } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { toServiceRequest } from '../../billing/adapters'
import { billingApi } from '../../billing/api'
import { money } from '../../billing/financeFormat'
import { BRANCH_STATUS } from '../configView'

// Saves the service with a new set of branches and prices; the rest of the record is sent unchanged.
async function saveBranches(service, branches) {
  await billingApi.updateService(service.id, service.version, toServiceRequest({ ...service, branches }))
}

export function AddServiceLocationsDrawer({ open, onClose, service, branches, onSaved }) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)

  const candidates = branches.filter((branch) => !service.branches[branch.id] && branch.status !== 'inactive')
  const already = branches.filter((branch) => service.branches[branch.id])
  const needle = query.trim().toLowerCase()
  const visible = candidates.filter((option) => !needle || `${option.name} ${option.code} ${option.city}`.toLowerCase().includes(needle))
  const count = selectedIds.length

  const toggle = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  const finish = () => {
    setQuery('')
    setSelectedIds([])
    setFailure('')
    onClose()
  }
  const save = async () => {
    setPending(true)
    setFailure('')
    try {
      await saveBranches(service, { ...service.branches, ...Object.fromEntries(selectedIds.map((id) => [id, { available: true, price: null }])) })
      onSaved(`${count} ${count === 1 ? 'location' : 'locations'} added at the default price.`)
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
      title="Add Locations"
      description={`Select clinic locations where ${service.name} can be charged. They start at the default price.`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant"><strong className="text-on-surface">{count} {count === 1 ? 'location' : 'locations'} selected</strong></p>
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="primary" icon={ShieldCheck} disabled={count === 0 || pending} onClick={save}>{pending ? 'Saving…' : `Add ${count} ${count === 1 ? 'location' : 'locations'}`}</ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        {failure && <Banner tone="danger" title="Not saved">{failure}</Banner>}
        <SearchBox value={query} onChange={setQuery} label="Search locations" placeholder="Search by branch name, city or code…" />
        <ul className="flex flex-col gap-2">
          {visible.map((option) => (
            <li key={option.id}>
              <CheckRow checked={selectedIds.includes(option.id)} onChange={() => toggle(option.id)} label={option.name}>
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-on-surface">
                  {option.name}
                  <StatusPill tone={BRANCH_STATUS[option.status][1]}>{BRANCH_STATUS[option.status][0]}</StatusPill>
                  <span className="ml-auto font-mono text-[11px] font-normal text-outline">{option.code}</span>
                </p>
                <p className="text-xs text-on-surface-variant">{option.city}</p>
              </CheckRow>
            </li>
          ))}
          {visible.length === 0 && <li className="py-6 text-center text-sm text-on-surface-variant">{candidates.length ? 'No locations match your search.' : 'Offered at every open branch already.'}</li>}
        </ul>
        <p className="mt-2 text-[11px] font-semibold tracking-wide text-outline uppercase">Already offered ({already.length})</p>
        <ul className="flex flex-col gap-2">
          {already.map((branch) => (
            <li key={branch.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-surface-lowest px-3 py-2 text-xs opacity-70">
              {branch.name}
              <StatusPill tone="success">Already added</StatusPill>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  )
}

// One branch's price for the service: the default, a local price, or not offered there.
export function SetBranchPriceDrawer({ open, onClose, service, branch, onSaved }) {
  const entry = branch ? service.branches[branch.id] : null
  const [mode, setMode] = useState(entry?.price != null ? 'custom' : 'default')
  const [price, setPrice] = useState(entry?.price != null ? String(entry.price) : '')
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  if (!branch) return null

  const finish = () => {
    setFailure('')
    onClose()
  }
  const save = async (remove = false) => {
    if (!remove && mode === 'custom' && !(price.trim() !== '' && Number(price) >= 0)) return setFailure('Enter a price of zero or more.')
    setPending(true)
    setFailure('')
    const next = { ...service.branches }
    if (remove) delete next[branch.id]
    else next[branch.id] = { available: true, price: mode === 'custom' ? Number(price) : null }
    try {
      await saveBranches(service, next)
      onSaved(remove ? `${service.name} is no longer offered at ${branch.name}.` : `Price at ${branch.name} saved.`)
      finish()
    } catch (error) {
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }
  const lastActive = service.status === 'Active' && entry && Object.keys(service.branches).length === 1

  return (
    <Drawer
      open={open}
      onClose={finish}
      title={`Price at ${branch.name}`}
      description={`Default price ${money(service.price)}. A branch price applies to new charges at ${branch.name} only.`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {entry && !lastActive ? <ActionButton variant="danger" onClick={() => save(true)} disabled={pending}>Stop offering here</ActionButton> : <span />}
          <div className="flex gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={() => save(false)} disabled={pending}>{pending ? 'Saving…' : entry ? 'Save price' : 'Offer at this branch'}</ActionButton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        {failure && <Banner tone="danger" title={failure} />}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Price</legend>
          {[['default', `Use the default (${money(service.price)})`], ['custom', 'Set a branch price']].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-xs">
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="accent-brand" />
              {label}
            </label>
          ))}
        </fieldset>
        {mode === 'custom' && <TextInput label="Branch price (INR ₹)" type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} />}
        {lastActive && <InfoNote>This is the only location of an active service; deactivate the service before removing it here.</InfoNote>}
        <InfoNote tone="brand">Past charges and invoices keep the price they were raised at.</InfoNote>
      </div>
    </Drawer>
  )
}
