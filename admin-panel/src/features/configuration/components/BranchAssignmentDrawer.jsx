import { useState } from 'react'
import { Check, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'

const DEPARTMENTS = ['General Medicine', 'Cardiology', 'Paediatrics', 'Emergency Triage', 'Reception & Desk', 'Administration']

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

// Edits one person's assignment at the current branch. State is local until a roster API exists.
export default function BranchAssignmentDrawer({ open, onClose, person }) {
  const navigate = useNavigate()
  const [department, setDepartment] = useState('General Medicine')
  const [operational, setOperational] = useState(true)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)

  const finish = () => {
    setConfirmingRemoval(false)
    onClose()
  }

  const remove = () => {
    finish()
    navigate(pathFor(ROUTES.branchStaff, { branchId: 'main' }))
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Branch configuration · Main Clinic"
      title="Branch assignment"
      footer={
        <>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton onClick={finish}>Cancel</ActionButton>
            <ActionButton variant="brand" icon={Check} onClick={finish}>
              Save changes
            </ActionButton>
          </div>
          <p className="mt-2 text-center text-[11px] text-outline">Changes apply immediately to Main Clinic scheduling calendars.</p>
        </>
      }
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-sm font-semibold text-on-surface">
          {person.name} <StatusPill tone="success" className="ml-1">Active</StatusPill>
        </p>
        <p className="mt-0.5 text-xs text-on-surface-variant">Doctor · {person.designation} · REG-TS-48291 · NPI-883920</p>
        <ActionButton variant="soft" size="sm" className="mt-2" onClick={finish}>
          View profile
        </ActionButton>
      </div>

      <Section number={1} title="Branch" aside="Bound to facility">
        <div className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3">
          <div>
            <p className="text-[13px] font-semibold text-on-surface">Main Clinic (HYD-HQ-01)</p>
            <p className="text-xs text-on-surface-variant">Primary Surgical Pavilion & Diagnostics</p>
          </div>
          <StatusPill tone="success">Assigned</StatusPill>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-outline">Assignment effective date</dt>
            <dd className="font-medium text-on-surface">12 Sep 2026</dd>
          </div>
          <div>
            <dt className="text-outline">Local OPD chamber</dt>
            <dd className="font-medium text-on-surface">Chamber 02 (Shift A)</dd>
          </div>
        </dl>
        <InfoNote tone="brand" icon={Info} className="mt-3">
          This assignment governs local OPD scheduling, chamber access, and encounter signing at Main Clinic. Global employee record remains centrally maintained.
        </InfoNote>
      </Section>

      <Section number={2} title="Department" aside="Code #DEP-GENMED">
        <p className="mb-2 flex items-center justify-between text-xs text-on-surface-variant">
          Current assigned department
          <span className="font-semibold text-on-surface">{department}</span>
        </p>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold text-slate-800">Switch to another Main Clinic department</legend>
          <div className="grid grid-cols-2 gap-2">
            {DEPARTMENTS.map((name) => (
              <RadioCard key={name} name="department" value={name} checked={department === name} onChange={() => setDepartment(name)} title={name} />
            ))}
          </div>
        </fieldset>
        <p className="mt-2 text-[11px] text-outline">Changing department re-routes local OPD appointment slots and shared clinical tasks.</p>
      </Section>

      <Section number={3} title="Branch status" aside="Active operational">
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
          <p className="text-xs">
            Operational capability: <strong className={operational ? 'text-brand' : 'text-outline'}>{operational ? 'Active (Operational)' : 'Paused at this branch'}</strong>
          </p>
          <ActionButton size="sm" onClick={() => setOperational((current) => !current)}>
            {operational ? 'Deactivate branch assignment' : 'Reactivate assignment'}
          </ActionButton>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-outline">
          Deactivating this assignment removes {person.name} from active booking calendars, new encounter creation, and chamber rosters at Main Clinic. All historical records remain fully preserved.
        </p>
      </Section>

      <Section number={4} title="Other branch assignments" aside="Read-only (enterprise context)">
        <ul className="flex flex-col gap-2">
          {[
            ['Kondapur Clinic', 'OPD Consultations (Wed & Sat)'],
            ['Banjara Hills Clinic', 'Weekly Specialist Clinic'],
          ].map(([name, detail]) => (
            <li key={name} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-xs">
              <span>
                <span className="block text-[13px] font-semibold text-on-surface">{name}</span>
                <span className="text-on-surface-variant">{detail}</span>
              </span>
              <StatusPill tone="success">Active</StatusPill>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-outline">
          {person.name} holds multi-branch assignments across St. Jude Surgical Health System. Modifying Main Clinic does not affect assignments at other facilities.
        </p>
      </Section>

      <Section number={5} title="Assignment summary">
        <dl className="space-y-1.5 text-xs">
          {[
            ['Person', person.name],
            ['Type', 'Doctor'],
            ['Branch', 'Main Clinic (HYD-HQ-01)'],
            ['Department', department],
            ['Status', operational ? 'Active' : 'Paused'],
            ['ABDM HPR sync', 'Linked & Verified'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">{label}</dt>
              <dd className="font-semibold text-on-surface">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section number={6} title="Danger zone">
        <div className="rounded-md border border-red-200 bg-red-50/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-danger">Unassign from this facility</p>
              <p className="text-xs leading-4 text-on-surface-variant">
                Remove this person from Main Clinic. Their organization profile and historical records will remain intact.
              </p>
            </div>
            {!confirmingRemoval && (
              <ActionButton variant="danger" size="sm" onClick={() => setConfirmingRemoval(true)}>
                Remove from branch
              </ActionButton>
            )}
          </div>
          {confirmingRemoval && (
            <div className="mt-3 rounded-md border border-red-200 bg-white p-3">
              <p className="text-xs font-semibold text-danger">Remove {person.name} from Main Clinic?</p>
              <p className="mt-1 text-[11px] leading-4 text-on-surface-variant">
                They will no longer be assigned to this branch. Historical appointments, encounters, billing records, and clinical records remain preserved.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <ActionButton size="sm" onClick={() => setConfirmingRemoval(false)}>Cancel</ActionButton>
                <ActionButton variant="danger" size="sm" onClick={remove}>Remove from branch</ActionButton>
              </div>
            </div>
          )}
        </div>
      </Section>
    </Drawer>
  )
}
