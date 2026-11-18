import { useEffect, useState } from 'react'
import { ArrowRight, ShieldCheck, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useFormFields } from '../../../hooks/useFormFields'
import { accessApi } from '../../auth/api'
import LoadingState from '../../patients/components/LoadingState'
import { toPersonView } from '../adapters'
import { staffApi } from '../api'
import PersonBanner from '../components/PersonBanner'
import StaffNotFound from '../components/StaffNotFound'
import { validateAccountSetup } from '../validation'

export default function UserAccountPage() {
  const { staffId } = useParams()
  const person = useApiResource(() => staffApi.get(staffId), staffId)
  if (person.loading && !person.data) return <WorkspacePage><LoadingState label="Loading staff record…" /></WorkspacePage>
  if (!person.data) return <StaffNotFound title="Set up user account" />
  return <AccountSetup key={person.data.id} record={person.data} onChange={person.reload} />
}

function AccountSetup({ record, onChange }) {
  const navigate = useNavigate()
  const person = toPersonView(record)
  const [values, handleChange] = useFormFields({ email: record.email ?? '', role: '' })
  const [submitted, setSubmitted] = useState(false)
  const [roles, setRoles] = useState([])
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')
  const [outcome, setOutcome] = useState(null)

  // Only active roles can be granted; the API also refuses roles above the inviter's own access.
  useEffect(() => {
    accessApi
      .roles()
      .then((list) => setRoles(list.filter((role) => role.status === 'active')))
      .catch((error) => setFailure(error.message))
  }, [])

  const profilePath = pathFor(ROUTES.staffMember, { staffId: record.id })
  const validate = () => ({ ...validateAccountSetup(values), ...(!values.role && { role: 'Choose the role this person will have.' }) })
  const errors = submitted ? validate() : {}

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validate()).length > 0) return
    setPending(true)
    try {
      const role = roles.find((entry) => entry.name === values.role)
      const email = values.email.trim().toLowerCase()
      const result = await staffApi.invite(record.id, email, [role.id])
      setOutcome({ kind: result.result, email })
      onChange()
    } catch (error) {
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  if (record.account.linked) {
    return (
      <WorkspacePage>
        <PageIntro title="User account" description="This person already signs in to ClinicOS." />
        <PersonBanner person={person} subtitle={`${person.type} (${person.role}) · ${person.department}`} facts={[['Sign-in email', record.account.email], ['Roles', record.account.roles.join(', ') || '—'], ['Account status', record.account.status]]} />
        <InfoNote icon={ShieldCheck}>Change this person&apos;s roles or suspend their access in Settings → Roles &amp; members.</InfoNote>
        <div className="mt-5"><ActionButton to={profilePath}>Back to profile</ActionButton></div>
      </WorkspacePage>
    )
  }

  return (
    <WorkspacePage>
      <form onSubmit={handleSubmit} noValidate className="pb-20">
        <PageIntro
          eyebrow={<StatusPill>ClinicOS login</StatusPill>}
          title="Set up user account"
          description="Give this person a ClinicOS login with a role. The staff record is linked to the account once they accept."
        />

        <PersonBanner
          person={person}
          subtitle={`${person.type} (${person.role}) · ${person.department}`}
          facts={[
            ['Registration', person.registry],
            ['Branch deployments', person.branches.length ? person.branches.join(' & ') : 'Not assigned yet'],
            ['Department', person.department],
          ]}
        />

        <div className="flex flex-col gap-5">
          {outcome?.kind === 'invited' && (
            <Banner tone="brand" title="Invitation sent">
              {outcome.email} will receive a single-use link that expires in 72 hours. This record links to their account when they accept.
            </Banner>
          )}
          {outcome?.kind === 'linked' && <Banner tone="brand" title="Account linked">{outcome.email} already belongs to a member of this organisation, so the record is now linked to that account.</Banner>}
          {!outcome && record.account.invitationPending && <Banner tone="brand" title="Invitation pending">An invitation was sent to {record.account.invitedEmail}. Sending a new one replaces it.</Banner>}
          {failure && <Banner tone="danger">{failure}</Banner>}
          <Panel title="Section 1: Login & role" subtitle={`The email ${person.name} will sign in with, and what they may do.`}>
            <TextInput label="Work email (sign-in username)" name="email" type="email" required value={values.email} onChange={handleChange} error={errors.email} />
            <SelectInput label="Role" name="role" required placeholder="Choose a role" options={roles.map((role) => role.name)} value={values.role} onChange={handleChange} error={errors.role} />
          </Panel>

          <Panel title="Section 2: How the login is issued" bodyClassName="flex flex-col gap-3">
            <dl className="grid gap-3 rounded-md bg-surface-lowest p-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-outline">Invitation destination</dt>
                <dd className="font-semibold text-brand">{values.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-outline">Link expiry window</dt>
                <dd className="font-semibold text-on-surface">72 hours, single use</dd>
              </div>
            </dl>
            <InfoNote icon={ShieldCheck}>
              <strong className="text-on-surface">Secure by design:</strong> the person sets their own password from the emailed link. Nobody else ever sees it, and the link stops working once used.
            </InfoNote>
          </Panel>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 lg:pl-72">
          <p className="flex items-center gap-2 text-xs text-on-surface-variant">
            <X className="size-3.5" aria-hidden="true" />
            <button type="button" onClick={() => navigate(profilePath)} className="font-medium hover:underline">Return to profile</button>
          </p>
          <ActionButton variant="primary" type="submit" disabled={pending}>
            {pending ? 'Sending invitation…' : 'Send Invitation'} <ArrowRight className="size-3.5" aria-hidden="true" />
          </ActionButton>
        </div>
      </form>
    </WorkspacePage>
  )
}
