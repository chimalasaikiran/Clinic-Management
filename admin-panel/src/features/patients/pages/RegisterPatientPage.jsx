import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Landmark, Lock, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, Toggle } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { ledgerSummary } from '../billing'
import FormSection from '../components/FormSection'
import PatientNotFound from '../components/PatientNotFound'
import { KeyValueRows } from '../components/parts'
import { usePatientRecords } from '../context/usePatientRecords'
import { REGISTRATION_BRANCHES } from '../data/catalog'
import { BLOOD_GROUPS, CONSULT_LANGUAGES, FIRST_NEW_MRN, INTAKE_UNITS, PATIENTS, RELATIONSHIPS, TITLE_PREFIXES } from '../data/patients'
import { ageFrom, digitsOf, formatDate, formatINR, TODAY } from '../format'
import { validatePatient } from '../validation'

const BLANK = {
  title: '', fullName: '', alias: '', aadhaarLast4: '', mobile: '', altMobile: '', email: '', house: '', area: '', city: 'Hyderabad', state: 'Telangana', pin: '',
  dob: '', gender: '', bloodGroup: '', language: 'English', emergencyName: '', emergencyRelation: '', emergencyPhone: '',
  whatsapp: true, sms: true, branch: REGISTRATION_BRANCHES[0], intakeUnit: INTAKE_UNITS[0], abha: '', mobileVerified: false,
}

// Reverse of the store's patientFromForm for the edit flow.
function valuesFromPatient(patient) {
  const pin = /(\d{6})\s*$/.exec(patient.address ?? '')?.[1] ?? ''
  return {
    ...BLANK,
    title: patient.gender === 'Male' ? 'Mr.' : 'Ms.',
    fullName: patient.name,
    mobile: digitsOf(patient.mobile).slice(-10),
    email: patient.email ?? '',
    house: (patient.address ?? '').replace(/[\s—-]*\d{6}\s*$/, ''),
    pin,
    dob: patient.dob ?? '',
    gender: patient.gender,
    bloodGroup: patient.bloodGroup === 'Unknown' ? '' : patient.bloodGroup,
    emergencyName: patient.emergencyName ?? '',
    emergencyRelation: patient.emergencyRelation ?? '',
    emergencyPhone: patient.emergencyPhone ?? '',
    branch: REGISTRATION_BRANCHES.find((name) => name.startsWith(patient.branch)) ?? REGISTRATION_BRANCHES[0],
    abha: patient.abha === 'Not linked' ? '' : patient.abha,
    mobileVerified: patient.contactNote !== 'Unverified',
  }
}

export default function RegisterPatientPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { patients, records, getPatient, addPatient, updatePatient } = usePatientRecords()
  const editing = patientId ? getPatient(patientId) : null
  const [values, setValues] = useState(() => (editing ? valuesFromPatient(editing) : BLANK))
  const [submitted, setSubmitted] = useState(false)
  const [dismissedMatch, setDismissedMatch] = useState(null)

  const mobileDigits = digitsOf(values.mobile).slice(-10)
  const duplicate = useMemo(
    () => (mobileDigits.length === 10 ? patients.find((patient) => patient.id !== editing?.id && digitsOf(patient.mobile).slice(-10) === mobileDigits) : undefined),
    [patients, mobileDigits, editing],
  )
  const duplicateResolved = !duplicate || dismissedMatch === duplicate.id
  const errors = submitted ? validatePatient(values, { duplicateResolved }) : {}

  if (patientId && !editing) {
    return (
      <WorkspacePage>
        <PatientNotFound />
      </WorkspacePage>
    )
  }

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const update = (event) => set(event.target.name, event.target.value)
  const newMrn = `PT-${String(FIRST_NEW_MRN + (patients.length - PATIENTS.length)).padStart(6, '0')}`
  const duplicateLedger = duplicate ? ledgerSummary({ invoices: records.invoices.filter((entry) => entry.patientId === duplicate.id), payments: records.payments.filter((entry) => entry.patientId === duplicate.id), refunds: records.refunds.filter((entry) => entry.patientId === duplicate.id) }) : null

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validatePatient(values, { duplicateResolved })).length) return
    const patient = editing ? (updatePatient(editing.id, values), editing) : addPatient(values)
    navigate(pathFor(ROUTES.patientHub, { patientId: patient.id }))
  }

  return (
    <WorkspacePage>
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-outline">
        <Link to={ROUTES.patients} className="hover:text-on-surface">Patients</Link>›
        <span className="font-medium text-on-surface">{editing ? 'Edit patient' : 'Register patient'}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-bold tracking-tight">
            {editing ? `Edit ${editing.name}` : 'Register patient'}
            <StatusPill tone="success" className="text-[11px]">PT-Master Scope Active</StatusPill>
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">Create an authoritative organization-level patient record that syncs across all clinic branches, appointments, and care workflows.</p>
        </div>
        <InfoNote tone="brand" icon={ShieldCheck} className="max-w-xs">
          <strong className="text-on-surface">{values.branch}</strong>
          <br />Multi-Branch Synchronization Active
        </InfoNote>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <FormSection number="01" title="Patient identity" tag="Authoritative Master Identity">
            <div className="grid gap-4 rounded-md border border-slate-200 bg-surface-lowest p-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Permanent master ID (MRN)</p>
                <p className="mt-1 flex items-center gap-2 text-xl font-bold">
                  {editing ? editing.mrn : newMrn}
                  <StatusPill tone="success"><Lock className="size-3" aria-hidden="true" />Auto-reserved</StatusPill>
                </p>
              </div>
              <TextInput label="ABDM national health ID (ABHA)" name="abha" value={values.abha} onChange={update} placeholder="14-0000-0000-0000" hint="Optional" />
            </div>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <SelectInput label="Title prefix" name="title" required value={values.title} onChange={update} error={errors.title} placeholder="Select" options={TITLE_PREFIXES} />
              <TextInput label="Full legal name" name="fullName" required value={values.fullName} onChange={update} error={errors.fullName} hint="Matches Indian Government ID records (Aadhaar / Voter ID / Passport)" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Preferred name / alias" name="alias" value={values.alias} onChange={update} placeholder="Known as, nickname, or clinical alias" hint="Optional" />
              <TextInput label="Aadhaar card reference (last 4 digits)" name="aadhaarLast4" inputMode="numeric" maxLength={4} prefix="XXXX-XXXX-" value={values.aadhaarLast4} onChange={update} error={errors.aadhaarLast4} hint="Stored encrypted" />
            </div>
          </FormSection>

          <FormSection number="02" title="Contact information" tag="Primary Communication Matrix">
            <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto]">
              <TextInput label="Primary mobile number" name="mobile" required prefix="+91" inputMode="tel" value={values.mobile} onChange={update} error={errors.mobile} hint="Critical identifier: used for OTP triage verification and multi-branch lookup." />
              <ActionButton className="mt-6" disabled title="The SMS OTP gateway is not connected in this build">Verify via SMS OTP</ActionButton>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Alternate phone / WhatsApp number" name="altMobile" prefix="+91" value={values.altMobile} onChange={update} error={errors.altMobile} />
              <TextInput label="Email address" name="email" type="email" value={values.email} onChange={update} error={errors.email} />
            </div>
            <p className="text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">Residential address</p>
            <TextInput label="House / flat / building / floor" name="house" value={values.house} onChange={update} />
            <div className="grid gap-4 sm:grid-cols-4">
              <TextInput label="Area / colony / landmark" name="area" value={values.area} onChange={update} className="sm:col-span-2" />
              <TextInput label="City" name="city" value={values.city} onChange={update} />
              <TextInput label="State" name="state" value={values.state} onChange={update} />
            </div>
            <TextInput label="PIN code" name="pin" required inputMode="numeric" maxLength={6} value={values.pin} onChange={update} error={errors.pin} className="sm:max-w-40" />
          </FormSection>

          <FormSection number="03" title="Demographics" tag="Clinical Stratification">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Date of birth" name="dob" type="date" required value={values.dob} onChange={update} error={errors.dob} hint={values.dob && values.dob <= TODAY ? `Age ${ageFrom(values.dob)} yrs` : undefined} />
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold text-slate-800">Gender at birth <span className="text-rose-500">*</span></legend>
                <div className="grid grid-cols-3 gap-2">
                  {['Male', 'Female', 'Other'].map((option) => (
                    <label key={option} className={cn('flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border text-[13px]', values.gender === option ? 'border-brand bg-teal-50 font-semibold text-brand' : 'border-slate-200')}>
                      <input type="radio" name="gender" value={option} checked={values.gender === option} onChange={update} className="sr-only" />
                      {option}
                    </label>
                  ))}
                </div>
                {errors.gender && <p role="alert" className="mt-1 text-xs text-rose-600">{errors.gender}</p>}
              </fieldset>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Blood group" name="bloodGroup" value={values.bloodGroup} onChange={update} placeholder="Select blood group" options={BLOOD_GROUPS} />
              <SelectInput label="Preferred consultation language" name="language" value={values.language} onChange={update} options={CONSULT_LANGUAGES} />
            </div>
          </FormSection>

          <FormSection number="04" title="Emergency contact & communication" tag="Safety Escort Protocol">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextInput label="Emergency contact person" name="emergencyName" value={values.emergencyName} onChange={update} />
              <SelectInput label="Relationship" name="emergencyRelation" value={values.emergencyRelation} onChange={update} placeholder="Select" options={RELATIONSHIPS} />
              <TextInput label="Contact phone number" name="emergencyPhone" value={values.emergencyPhone} onChange={update} error={errors.emergencyPhone} />
            </div>
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-surface-lowest">
              {[
                ['whatsapp', 'WhatsApp clinical updates & prescriptions', 'Auto-dispatch digital lab bills, appointment reminders, and follow-up slips via official WhatsApp API.'],
                ['sms', 'SMS vital alerts & billing OTPs', 'High-priority transaction receipts and admission confirmation SMS.'],
              ].map(([name, title, detail]) => (
                <div key={name} className="flex items-center justify-between gap-4 p-3">
                  <div>
                    <p className="text-[13px] font-semibold">{title}</p>
                    <p className="text-xs text-on-surface-variant">{detail}</p>
                  </div>
                  <Toggle checked={values[name]} onChange={(next) => set(name, next)} label={title} />
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection number="05" title="Registration context & branch attribution" tag="Multi-Clinic Sync Engine">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Originating registration branch" name="branch" value={values.branch} onChange={update} options={REGISTRATION_BRANCHES} />
              <SelectInput label="Initial intake clinical unit" name="intakeUnit" value={values.intakeUnit} onChange={update} options={INTAKE_UNITS} />
            </div>
            <InfoNote tone="brand" icon={Landmark}>
              <strong className="text-brand">Organization-level master sync active</strong>
              <br />This master record will be instantly accessible across all branches without creating duplicate files or fractured ledger histories.
            </InfoNote>
          </FormSection>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
            {errors.duplicate ? <p role="alert" className="text-xs text-rose-600">{errors.duplicate}</p> : <p className="text-xs text-outline">Required fields are marked with *</p>}
            <div className="flex gap-2">
              <ActionButton to={editing ? pathFor(ROUTES.patientHub, { patientId: editing.id }) : ROUTES.patients}>Cancel</ActionButton>
              <ActionButton variant="primary" type="submit">{editing ? 'Save changes' : 'Register patient'}</ActionButton>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <section className={cn('rounded-lg border p-5', duplicate ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-white')}>
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                {duplicate ? <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" /> : <CheckCircle2 className="size-4 text-brand" aria-hidden="true" />}
                Duplicate Detection Engine
              </h2>
              <StatusPill tone={duplicate ? 'warning' : 'success'}>{duplicate ? '1 match alert' : 'No matches'}</StatusPill>
            </header>
            {duplicate ? (
              <>
                <p className="mb-3 text-xs text-on-surface-variant">Queried: <strong className="font-mono text-on-surface">+91 {mobileDigits}</strong> · Real-time check</p>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold">{duplicate.name} <span className="font-mono text-[11px] font-normal text-on-surface-variant">{duplicate.mrn}</span></p>
                  <p className="mb-2 text-[11px] text-on-surface-variant">{duplicate.age} yrs · {duplicate.gender}</p>
                  <KeyValueRows rows={[['Registered branch', duplicate.branch], ['Last clinical visit', duplicate.lastVisit ? formatDate(duplicate.lastVisit) : 'None'], ['Existing ledger balance', `${formatINR(duplicateLedger.outstanding, 2)} (${duplicateLedger.outstanding ? 'Due' : 'Settled'})`]]} />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <ActionButton variant="primary" to={pathFor(ROUTES.patientHub, { patientId: duplicate.id })}>View Existing Patient Record</ActionButton>
                  <ActionButton onClick={() => setDismissedMatch(duplicate.id)} disabled={dismissedMatch === duplicate.id}>
                    {dismissedMatch === duplicate.id ? 'Confirmed — not a duplicate' : 'Not a duplicate — Continue Registration'}
                  </ActionButton>
                </div>
              </>
            ) : (
              <p className="text-xs leading-5 text-on-surface-variant">Enter the primary mobile number. Existing patients with the same number are matched here before a new MRN is issued.</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><ShieldCheck className="size-4 text-brand" aria-hidden="true" />Master Data Governance</h2>
            <ul className="flex flex-col gap-3 text-xs leading-5 text-on-surface-variant">
              <li><strong className="text-on-surface">Zero Duplicate Record Policy</strong><br />Enforces a single patient ledger across billing, diagnostics, and appointments.</li>
              <li><strong className="text-on-surface">ABDM Milestone 1 &amp; 2 Ready</strong><br />Seamlessly shares FHIR-compliant encounter bundles with national health networks.</li>
              <li><strong className="text-on-surface">Immutable Audit Log</strong><br />Registration attributed to the signed-in user with timestamp.</li>
            </ul>
          </section>
        </div>
      </form>
    </WorkspacePage>
  )
}
