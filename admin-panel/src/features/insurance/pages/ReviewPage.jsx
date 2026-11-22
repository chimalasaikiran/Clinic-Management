import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import PageHeading from '../../../components/ui/PageHeading'
import SectionLabel from '../../../components/ui/SectionLabel'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { CheckOption, FieldError, Notice } from '../components/InsuranceKit'
import { configApi } from '../../configuration/api'
import InsuranceLayout from '../components/InsuranceLayout'
import { useInsuranceSetup } from '../context/useInsuranceSetup'
import { BILLING_METHODS, COVERAGE_SERVICES } from '../data/options'
import { validateAgreement } from '../validation'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// "2026-12-01" -> "01 Dec 2026"
const formatDate = (iso) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

function SummaryCard({ title, editTo, rows, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)]" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        <TextLink tone="teal" to={editTo} className="text-xs font-semibold" aria-label={`Edit ${title.toLowerCase()}`}>
          Edit
        </TextLink>
      </div>
      <dl className="flex flex-col gap-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-xs">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  )
}

export default function ReviewPage() {
  const navigate = useNavigate()
  const { draft, getPartner, branches, agreement, activate } = useInsuranceSetup()
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')

  if (draft.acceptance !== 'yes' || !draft.partnerIds.length) return <Navigate to={ROUTES.insurance} replace />
  if (Object.keys(validateAgreement(draft)).length) return <Navigate to={ROUTES.insuranceAgreement} replace />

  const methods = BILLING_METHODS.filter((method) => draft.methods.includes(method.id)).map((method) => method.label)
  const included = branches.filter((branch) => draft.branchIds.includes(branch.id))
  const excludedBranches = branches.filter((branch) => !draft.branchIds.includes(branch.id)).map((branch) => branch.name)
  const active = agreement?.status === 'active'
  const turnOn = async () => {
    setPending(true)
    setFailure('')
    try {
      await activate()
    } catch (failed) {
      setFailure(failed.message)
    } finally {
      setPending(false)
    }
  }
  const excludedServices = COVERAGE_SERVICES.filter((service) => !draft.services.includes(service.id)).map((service) => service.label)
  const notIncluded = [...excludedBranches, ...excludedServices]

  return (
    <InsuranceLayout step={3}>
      <PageHeading title="Your insurance draft is ready for review." description="Review your organization's proposed insurance setup. No agreement has been verified and no billing has been enabled." />

      <div className="flex flex-col gap-6 pt-7">
        {active ? (
          <Notice tone="success" icon={icons.completeCheck} title={`Active · ${agreement.code}`}>
            Activated by {agreement.activatedBy}. To change the terms, end this agreement and draft a new one.
          </Notice>
        ) : (
          <Notice tone="success" icon={icons.completeCheck} title={`Saved as draft${agreement ? ` · ${agreement.code}` : ''}`}>
            Your setup is saved. It has not been submitted to an insurer or TPA, and is not an active agreement until you activate it below.
          </Notice>
        )}

        <div className="flex flex-col gap-3">
          <SectionLabel title="Setup summary" tag="Draft" />
          <SummaryCard
            title="Insurance acceptance"
            editTo={ROUTES.insurance}
            rows={[
              ['Acceptance', 'Yes · Organization-level setup'],
              ['Billing methods', methods.join(' & ')],
              ['Partners', draft.partnerIds.map((id) => getPartner(id).name).join(', ')],
            ]}
          />
          <SummaryCard
            title="Partner & agreement"
            editTo={ROUTES.insuranceAgreement}
            rows={[
              ['Insurer', getPartner(draft.insurerId).name],
              ['Servicing TPA', draft.tpaId ? getPartner(draft.tpaId).name : 'Direct with insurer'],
              ['Reference', draft.reference],
              ['Proposed dates', `${formatDate(draft.startDate)} – ${formatDate(draft.endDate)}`],
              ['Status', active ? 'Active' : 'Draft'],
            ]}
          >
            <p className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <img src={icons.department} alt="" />
                {draft.document ? <a href={configApi.documentUrl(draft.document.id)} target="_blank" rel="noreferrer" className="font-semibold text-teal-700 hover:underline">{draft.document.fileName}</a> : 'No agreement document attached'}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-[0.5px] text-slate-500 uppercase">{active ? 'Active' : 'Draft'}</span>
            </p>
          </SummaryCard>
          <SummaryCard
            title="Branch & service coverage"
            editTo={ROUTES.insuranceAgreement}
            rows={[
              ['Included branches', included.map((branch) => `${branch.name} · ${branch.state}`).join(', ')],
              ['Services', COVERAGE_SERVICES.filter((service) => draft.services.includes(service.id)).map((service) => service.label).join(' · ')],
              ['Not included', notIncluded.length ? notIncluded.join(' · ') : 'Everything is included'],
            ]}
          />
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="mb-2 text-[13px] font-semibold text-slate-900">What happens next?</p>
          <ul className="flex flex-col gap-2.5 text-xs">
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-600" />
              <span>
                <span className="block font-medium text-slate-800">Review the agreement</span>
                <span className="text-[11px] text-slate-500">Your organization administrator checks the signed terms.</span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-600" />
              <span>
                <span className="block font-medium text-slate-800">Confirm before enabling billing</span>
                <span className="text-[11px] text-slate-500">Confirm empanelment and branch scope with the partner.</span>
              </span>
            </li>
          </ul>
        </div>

        {agreement && !active && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
            <p className="text-[13px] font-semibold text-slate-900">Activate this agreement</p>
            <CheckOption checked={confirmed} onChange={() => setConfirmed((current) => !current)}>I have checked the signed agreement, its dates and branch coverage with the partner.</CheckOption>
            <FieldError>{failure}</FieldError>
            <Button fullWidth disabled={!confirmed || pending} onClick={turnOn}>{pending ? 'Activating…' : 'Activate agreement'}</Button>
          </div>
        )}

        <div className="flex flex-col gap-3.5 border-t border-slate-200/70 pt-5">
          <Button fullWidth trailing={<img src={icons.arrowRight} alt="" />} onClick={() => navigate(ROUTES.dashboard)}>
            Return to workspace
          </Button>
          <div className="flex items-center justify-between gap-3 text-xs font-semibold">
            <TextLink to={ROUTES.insuranceAgreement}>
              <img src={icons.arrowLeft} alt="" />
              Edit draft
            </TextLink>
            <TextLink tone="teal" to={ROUTES.dashboard}>
              Review later
            </TextLink>
          </div>
        </div>
      </div>
    </InsuranceLayout>
  )
}
