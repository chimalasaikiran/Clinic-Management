import { useState } from 'react'
import { ArrowRight, ShieldCheck, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import { TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import PersonBanner from '../components/PersonBanner'
import StaffNotFound from '../components/StaffNotFound'
import { useStaffDirectory } from '../context/useStaffDirectory'
import { ANANYA } from '../data/ananya'
import { validateAccountSetup } from '../validation'

export default function UserAccountPage() {
  const { staffId } = useParams()
  const navigate = useNavigate()
  const { getPerson } = useStaffDirectory()
  const person = getPerson(staffId)

  const [values, handleChange] = useFormFields({
    email: person?.email || (staffId === ANANYA.id ? ANANYA.email : ''),
    mobile: (person?.mobile || (staffId === ANANYA.id ? ANANYA.mobile : '')).replace(/^\+91\s*/, ''),
    method: 'invite',
    resetOnFirstLogin: true,
  })
  const [submitted, setSubmitted] = useState(false)

  if (!person) return <StaffNotFound title="Set up user account" />

  const profilePath = pathFor(ROUTES.staffMember, { staffId })
  const errors = submitted ? validateAccountSetup(values) : {}
  const isInvite = values.method === 'invite'

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateAccountSetup(values)).length === 0) navigate(profilePath)
  }

  return (
    <WorkspacePage>
      <form onSubmit={handleSubmit} noValidate className="pb-20">
        <PageIntro
          eyebrow={<StatusPill>Authentication &amp; credentialing hub · Zero-trust IAM</StatusPill>}
          title="Set up user account"
          description="Provision sovereign digital identity and credential dispatch for this verified practitioner. Authentication is decoupled from the clinical person record."
        />

        <PersonBanner
          person={{ ...person, shortName: person.name, initials: person.initials }}
          badge={undefined}
          subtitle={`${person.type} (${person.role}) · ${person.department}`}
          facts={[
            ['Registration', person.registry],
            ['Branch deployments', person.branches.length ? person.branches.join(' & ') : 'Not assigned yet'],
            ['Clinical specialty dept', person.department],
          ]}
        />

        <div className="flex flex-col gap-5">
          <Panel title="Section 1: Login identifier & identity provisioning" subtitle={`Pre-populated and cryptographically anchored to ${person.name}'s verified person dossier.`} action={<StatusPill tone="brand">IAM ID: {staffId}</StatusPill>} bodyClassName="flex flex-col gap-5">
            <TextInput label="Institutional work email (principal username)" name="email" type="email" required value={values.email} onChange={handleChange} error={errors.email} />
            <TextInput label="Mobile number for 2FA & ABDM OTP handshake" name="mobile" type="tel" prefix="+91" required hint="E.164 compliant" value={values.mobile} onChange={handleChange} error={errors.mobile} />
          </Panel>

          <Panel title="Section 2: Authentication method & credential issuance" subtitle={`Select how ${person.name} will authenticate into the clinical operating ecosystem.`} bodyClassName="flex flex-col gap-3">
            <RadioCard
              name="method"
              value="invite"
              checked={isInvite}
              onChange={handleChange}
              title="Secure email invitation & passkey setup"
              badge={<StatusPill tone="success">Recommended · DISHA Compliant</StatusPill>}
              detail="Dispatches an encrypted 72-hour onboarding link. Practitioner self-configures passwordless WebAuthn/Passkey (Touch ID, Windows Hello, YubiKey) and Aadhaar ABDM-linked 2FA."
            />
            {isInvite && (
              <dl className="grid gap-3 rounded-md bg-surface-lowest p-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-outline">Invitation destination</dt>
                  <dd className="font-semibold text-brand">{values.email || '—'}</dd>
                </div>
                <div>
                  <dt className="text-outline">Link expiry window</dt>
                  <dd className="font-semibold text-on-surface">72 hours (auto-revoking token)</dd>
                </div>
              </dl>
            )}
            <RadioCard
              name="method"
              value="passcode"
              checked={!isInvite}
              onChange={handleChange}
              title="Direct temporary administrative passcode"
              badge={<StatusPill>Manual handoff</StatusPill>}
              detail="Issue a cryptographically secure one-time passcode with forced reset on initial login. Requires secure offline delivery by administrator."
            />
            {!isInvite && (
              <div className="grid gap-3 rounded-md bg-surface-lowest p-3 text-xs sm:grid-cols-2">
                <TextInput label="Generated temporary passcode" value="Generated when the account is provisioned" readOnly />
                <label className="flex items-center gap-2 self-end pb-3 text-on-surface-variant">
                  <input type="checkbox" name="resetOnFirstLogin" checked={values.resetOnFirstLogin} onChange={(event) => handleChange({ target: { name: 'resetOnFirstLogin', value: event.target.checked } })} className="accent-[#006a61]" />
                  Forced change upon initial authenticated handshake
                </label>
              </div>
            )}
            <InfoNote icon={ShieldCheck}>
              <strong className="text-on-surface">Zero-knowledge compliance notice:</strong> In accordance with DISHA &amp; ABDM Milestone M1–M3 security guidelines, plaintext passwords, tokens, or recovery secrets are never visible to administrators or stored in logs. All tokens utilize HMAC-SHA256 signatures with 15-minute rotation cycles.
            </InfoNote>
          </Panel>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 lg:pl-72">
          <p className="flex items-center gap-2 text-xs text-on-surface-variant">
            <X className="size-3.5" aria-hidden="true" />
            <button type="button" onClick={() => navigate(profilePath)} className="font-medium hover:underline">Return without provisioning</button>
            <span className="text-outline">Unsaved staged configuration will be discarded.</span>
          </p>
          <div className="flex gap-2">
            <ActionButton onClick={() => navigate(profilePath)}>Save as Staged Draft</ActionButton>
            <ActionButton variant="primary" type="submit">
              Provision Account &amp; Send Invitation <ArrowRight className="size-3.5" aria-hidden="true" />
            </ActionButton>
          </div>
        </div>
      </form>
    </WorkspacePage>
  )
}
