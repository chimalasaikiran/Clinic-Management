import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, Toggle } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import { cn } from '../../../lib/cn'
import { Check, OptionSelect, TextArea } from '../components/parts'
import { RELATIONSHIPS } from '../data/patients'
import { digitsOf, initialsOf } from '../format'
import { validateFamilyMember } from '../validation'

const TIERS = ['Tier 1 Primary', 'Tier 2 Secondary', 'Tier 3 Contingency']
const ACCESS = [
  ['clinical', 'Clinical records & diagnostic orders (EHR access)', 'Requires active ABDM M3 OTP-verified consent artefact.'],
  ['pharmacy', 'Prescription & medication collection authorization', 'Authorized to pick up prescribed drugs from the pharmacy counter upon photo ID.'],
  ['financial', 'Financial settlements & invoice collection', 'Authorized to settle OPD consultation tariffs and collect official payment receipts.'],
  ['emergency', 'Emergency medical decisions & surgical consents', 'Reserved for the primary legal proxy under statutory advance directive.'],
]

const BLANK = { name: '', relationship: '', dob: '', gender: 'Male', mobile: '', email: '', location: '', caregiver: 'none', emergency: false, tier: TIERS[1], legalProxy: false, clinical: false, pharmacy: false, financial: false, emergencyDecisions: false, documentId: '', notifyMember: true, notifyPatient: true, note: '' }

function toValues(member) {
  if (!member) return BLANK
  return {
    ...BLANK, name: member.name, relationship: member.relationship, dob: member.dob ?? '', gender: member.gender, mobile: digitsOf(member.mobile).slice(-10), email: member.email, location: member.location,
    caregiver: member.caregiver === 'Primary Caregiver' ? 'primary' : member.caregiver === 'Secondary Caregiver' ? 'secondary' : 'none', emergency: Boolean(member.emergencyTier), tier: member.emergencyTier ?? TIERS[1],
    legalProxy: member.access === 'Legal Proxy', clinical: Boolean(member.grants?.clinical), pharmacy: Boolean(member.grants?.pharmacy), financial: Boolean(member.grants?.financial) || member.access.startsWith('Financial'),
    emergencyDecisions: Boolean(member.grants?.emergency), documentId: member.documentId ?? '', note: member.note ?? '',
  }
}

// Link a new person to the patient, or edit an existing link. `onSave` receives the member fields to store.
export default function FamilyDrawer({ open, onClose, patient, member, patients, onSave }) {
  const editing = Boolean(member)
  const [values, setValues] = useState(() => toValues(member))
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateFamilyMember(values) : {}
  const sameNumber = digitsOf(values.mobile).length === 10 ? patients.find((entry) => digitsOf(entry.mobile).slice(-10) === digitsOf(values.mobile)) : null

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const update = (event) => set(event.target.name, event.target.value)
  const finish = () => {
    setValues(toValues(member))
    setSubmitted(false)
    onClose()
  }

  const save = () => {
    setSubmitted(true)
    if (Object.keys(validateFamilyMember(values)).length) return
    const caregiver = { primary: 'Primary Caregiver', secondary: 'Secondary Caregiver', none: 'Non-caregiver' }[values.caregiver]
    const grants = { clinical: values.clinical, pharmacy: values.pharmacy, financial: values.financial, emergency: values.emergencyDecisions }
    const scope = [grants.clinical && 'Clinical records', grants.pharmacy && 'Medication pickup', grants.financial && 'Billing', grants.emergency && 'Emergency decisions'].filter(Boolean)
    onSave({
      name: values.name.trim(), initials: initialsOf(values.name), relationship: values.relationship, kinship: 'Immediate Kin', gender: values.gender, dob: values.dob, mobile: `+91 ${digitsOf(values.mobile).slice(-10).replace(/^(\d{5})(\d{5})$/, '$1 $2')}`,
      email: values.email.trim(), location: values.location.trim() || '—', caregiver, caregiverNote: values.caregiver === 'none' ? 'No active care tasks assigned' : 'Home-care support', emergencyTier: values.emergency ? values.tier : null,
      emergencyNote: values.emergency ? 'Dispatch priority per tier' : 'Not registered', access: values.legalProxy ? 'Legal Proxy' : values.clinical ? 'Clinical Access' : values.financial ? 'Financial Sponsor / Co-pay' : 'Limited Notifications',
      scope: scope.length ? scope.join(', ') : 'Appt reminders & status SMS', portal: values.clinical ? 'Portal account pending' : 'Portal not registered', grants, documentId: values.documentId.trim(), note: values.note.trim(), status: 'Active',
    }, editing ? member.id : null)
    finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow={editing ? `Persisted master record · ${member.personCode}` : 'Patient relationship registry'}
      title={editing ? `Edit Person & Relationship Matrix` : 'Link / Add Related Person'}
      description={`Subject patient: ${patient.name} (MRN ${patient.mrn})`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={finish}>Cancel (Esc)</ActionButton><ActionButton variant="primary" onClick={save}>{editing ? 'Save & Commit Changes' : 'Save & Link Related Person →'}</ActionButton></div>}
    >
      <div className="flex flex-col gap-5 p-5">
        <InfoNote tone="warning"><strong>Statutory role &amp; consent separation:</strong> relationship ≠ legal proxy ≠ clinical access ≠ financial authority. Adding a family member does not automatically grant authorization to inspect electronic medical records, collect prescriptions, or sign financial vouchers. Clinical and financial access strictly requires a verified ABDM digital consent artefact.</InfoNote>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">A · Person discovery &amp; identity matching</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Full legal name" name="name" required value={values.name} onChange={update} error={errors.name} />
            <OptionSelect label="Kinship / relationship to patient" required value={values.relationship} onChange={(event) => set('relationship', event.target.value)} error={errors.relationship} placeholder="Select relationship" options={RELATIONSHIPS.map((entry) => ({ value: entry, label: entry }))} />
            <TextInput label="Date of birth" name="dob" type="date" value={values.dob} onChange={update} />
            <fieldset><legend className="mb-1.5 text-[13px] font-semibold">Gender</legend><div className="grid grid-cols-3 gap-2">{['Male', 'Female', 'Other'].map((option) => <label key={option} className={cn('flex h-10 cursor-pointer items-center justify-center rounded-md border text-[13px]', values.gender === option ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200')}><input type="radio" name="gender" value={option} checked={values.gender === option} onChange={update} className="sr-only" />{option}</label>)}</div></fieldset>
            <TextInput label="Primary mobile number" name="mobile" required prefix="+91" value={values.mobile} onChange={update} error={errors.mobile} />
            <TextInput label="Email address" name="email" type="email" value={values.email} onChange={update} error={errors.email} />
          </div>
          {sameNumber && <InfoNote tone="brand" className="mt-3">This number belongs to registered patient <strong>{sameNumber.name}</strong> ({sameNumber.mrn}). Linking will reference the existing master record.</InfoNote>}
          <div className="mt-4"><TextInput label="Current residential address / locality" name="location" value={values.location} onChange={update} /></div>
        </section>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">B · Relationship roles specification</h3>
          <div className="flex flex-col gap-3 text-xs">
            <div className="rounded-md border border-slate-200 p-3"><p className="text-[13px] font-semibold">Family member <span className="text-brand">Active</span></p><p className="text-on-surface-variant">Recognized family relationship for visitation and routine updates.</p></div>
            <div className="rounded-md border border-slate-200 p-3"><p className="text-[13px] font-semibold">Caregiver</p><div role="radiogroup" aria-label="Caregiver role" className="mt-2 flex gap-2">{[['none', 'Not a caregiver'], ['secondary', 'Secondary caregiver'], ['primary', 'Primary caregiver']].map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={values.caregiver === id} onClick={() => set('caregiver', id)} className={cn('rounded-md border px-3 py-1.5', values.caregiver === id ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200')}>{label}</button>)}</div></div>
            <div className="rounded-md border border-slate-200 p-3"><div className="flex items-center justify-between"><p className="text-[13px] font-semibold">Emergency contact (designated)</p><Toggle checked={values.emergency} onChange={(next) => set('emergency', next)} label="Emergency contact" /></div>{values.emergency && <div role="radiogroup" aria-label="Dispatch priority level" className="mt-2 flex gap-2">{TIERS.map((tier) => <button key={tier} type="button" role="radio" aria-checked={values.tier === tier} onClick={() => set('tier', tier)} className={cn('rounded-md border px-3 py-1.5', values.tier === tier ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200')}>{tier}</button>)}</div>}</div>
            <div className="rounded-md border border-slate-200 p-3"><div className="flex items-center justify-between"><p className="text-[13px] font-semibold">Authorized representative / legal proxy <span className="text-[10px] font-normal text-outline">DISHA consent required</span></p><Toggle checked={values.legalProxy} onChange={(next) => set('legalProxy', next)} label="Legal proxy" /></div></div>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">C · Access scope &amp; DISHA / ABDM privacy governance</h3>
          <ul className="flex flex-col gap-2">{ACCESS.map(([key, title, detail]) => { const field = key === 'emergency' ? 'emergencyDecisions' : key; return <li key={key} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3 text-xs"><span><strong className="block text-[13px]">{title}</strong><span className="text-on-surface-variant">{detail}</span></span><Toggle checked={values[field]} onChange={(next) => set(field, next)} label={title} /></li> })}</ul>
          <div className="mt-4"><TextInput label="Verification document identifier (masked)" name="documentId" value={values.documentId} onChange={update} error={errors.documentId} hint={values.legalProxy ? 'Required for a legal proxy' : 'Optional'} /></div>
        </section>

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-semibold">D · Audit trail &amp; notification gateways</h3>
          <div className="flex flex-col gap-2"><Check checked={values.notifyMember} onChange={(event) => set('notifyMember', event.target.checked)} label="Send a welcome and relationship confirmation notice to the related person by SMS/WhatsApp" /><Check checked={values.notifyPatient} onChange={(event) => set('notifyPatient', event.target.checked)} label={`Send an instant security alert to ${patient.name} (${patient.mobile}) confirming the family link`} /></div>
          <div className="mt-4"><TextArea label="Internal clinical / administrative note (encrypted in audit vault)" rows={2} name="note" value={values.note} onChange={update} /></div>
        </section>
      </div>
    </Drawer>
  )
}
