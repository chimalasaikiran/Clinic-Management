import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import FileUploadField from '../../../components/ui/FileUploadField'
import PageHeading from '../../../components/ui/PageHeading'
import SectionLabel from '../../../components/ui/SectionLabel'
import SelectableCard from '../../../components/ui/SelectableCard'
import SelectField from '../../../components/ui/SelectField'
import TextField from '../../../components/ui/TextField'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { CheckOption, FieldError, Notice, StepActions } from '../components/InsuranceKit'
import InsuranceLayout from '../components/InsuranceLayout'
import { useInsuranceSetup } from '../context/useInsuranceSetup'
import { COVERAGE_SERVICES } from '../data/options'
import { agreementFileError, validateAgreement } from '../validation'

const NO_TPA = 'Direct with insurer (no TPA)'
const toggle = (list, id) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id])
const fileSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`)

export default function AgreementPage() {
  const navigate = useNavigate()
  const { draft, getPartner, update, saveAgreement, branches } = useInsuranceSetup()
  const [submitted, setSubmitted] = useState(false)
  const [fileError, setFileError] = useState('')
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')

  if (draft.acceptance !== 'yes' || !draft.partnerIds.length) return <Navigate to={ROUTES.insurance} replace />

  const selected = draft.partnerIds.map(getPartner)
  const insurers = selected.filter((partner) => partner.type === 'Insurer')
  const tpas = selected.filter((partner) => partner.type === 'TPA')
  // A partner deselected on the previous step can no longer back the agreement.
  const fields = {
    ...draft,
    insurerId: insurers.some((partner) => partner.id === draft.insurerId) ? draft.insurerId : '',
    tpaId: tpas.some((partner) => partner.id === draft.tpaId) ? draft.tpaId : '',
  }
  const errors = submitted ? validateAgreement(fields) : {}
  const field = (key) => (event) => update({ [key]: event.target.value })

  const handleFile = (file) => {
    const message = agreementFileError(file)
    setFileError(message)
    update(file && !message ? { file, document: null } : { file: null })
  }

  const save = async (next) => {
    setSubmitted(true)
    setFailure('')
    if (fileError || Object.keys(validateAgreement(fields)).length) return
    update({ insurerId: fields.insurerId, tpaId: fields.tpaId })
    setPending(true)
    try {
      await saveAgreement()
      navigate(next)
    } catch (failed) {
      setFailure(failed.message)
      setPending(false)
    }
  }
  const handleSubmit = (event) => {
    event.preventDefault()
    save(ROUTES.insuranceReview)
  }
  const finishLater = () => save(ROUTES.dashboard)
  const attached = draft.file ?? (draft.document ? { name: draft.document.fileName, size: draft.document.size } : null)

  return (
    <InsuranceLayout step={2}>
      <PageHeading title="Add your agreement & branch coverage." description="Capture proposed terms for your organization. Everything below is a draft for internal review." />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-7 pt-7">
        <Notice tone="warning" title="Draft only · Not verified or activated">
          These details do not confirm insurer empanelment. Check the signed agreement before enabling insurance billing.
        </Notice>

        <section className="flex flex-col gap-4">
          <SectionLabel title="Agreement details" tag="Draft" />
          <SelectField
            label="Insurer"
            required
            placeholder="Choose an insurer"
            options={insurers.map((partner) => partner.name)}
            value={getPartner(fields.insurerId)?.name ?? ''}
            onChange={(event) => update({ insurerId: insurers.find((partner) => partner.name === event.target.value)?.id ?? '' })}
            error={errors.insurerId}
            hint={insurers.length ? undefined : 'Select an insurer on the previous step'}
          />
          <SelectField
            label="Servicing TPA"
            options={[NO_TPA, ...tpas.map((partner) => partner.name)]}
            value={getPartner(fields.tpaId)?.name ?? NO_TPA}
            onChange={(event) => update({ tpaId: tpas.find((partner) => partner.name === event.target.value)?.id ?? '' })}
          />
          <TextField label="Agreement reference" required value={draft.reference} onChange={field('reference')} error={errors.reference} placeholder="e.g. AGR-BLR-2026-01" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Proposed start date" type="date" required value={draft.startDate} onChange={field('startDate')} error={errors.startDate} />
            <TextField label="Proposed end date" type="date" required value={draft.endDate} onChange={field('endDate')} error={errors.endDate} />
          </div>
          <p className="text-[11px] text-slate-500">* Required for review. End date must be after the start date.</p>
          <FileUploadField label="Agreement document" hint="Optional" title="Upload the agreement" helper="PDF up to 10 MB" accept="application/pdf,.pdf" onFileChange={handleFile} />
          <FieldError>{fileError}</FieldError>
          {attached && !fileError && (
            <p className="flex items-center gap-2 text-xs text-slate-600">
              <img src={icons.check} alt="" /> {draft.file ? 'Will upload' : 'Attached'}: {attached.name} · {fileSize(attached.size)}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel title="Branch & service coverage" tag={`${draft.branchIds.length} branch${draft.branchIds.length === 1 ? '' : 'es'}`} />
          <p className="text-xs leading-[18px] text-slate-500">Choose at least one branch. Coverage applies only to the branches and services selected here.</p>
          <div className="flex flex-col gap-2.5">
            {branches.map((branch) => {
              const included = draft.branchIds.includes(branch.id)
              return (
                <SelectableCard
                  key={branch.id}
                  role="checkbox"
                  title={branch.name}
                  description={`${branch.code} · ${branch.city}, ${branch.state}`}
                  tag={included ? 'Included' : 'Not included'}
                  indicator
                  selected={included}
                  onClick={() => update({ branchIds: toggle(draft.branchIds, branch.id) })}
                />
              )
            })}
          </div>
          <FieldError>{errors.branches}</FieldError>
          <div className="flex flex-wrap gap-5">
            {COVERAGE_SERVICES.map((service) => (
              <CheckOption key={service.id} checked={draft.services.includes(service.id)} onChange={() => update({ services: toggle(draft.services, service.id) })}>
                {service.label}
              </CheckOption>
            ))}
          </div>
          <FieldError>{errors.services}</FieldError>
          <p className="text-[11px] leading-4 text-slate-500">Proposed scope only. Patient eligibility, authorisation and benefits must be checked separately for each encounter.</p>
        </section>

        <FieldError>{failure}</FieldError>
        <StepActions
          pending={pending}
          submitLabel={pending ? 'Saving…' : 'Review insurance setup'}
          back={
            <TextLink to={ROUTES.insurance}>
              <img src={icons.arrowLeft} alt="" />
              Back to partners
            </TextLink>
          }
          secondary={
            <TextLink tone="teal" onClick={finishLater}>
              Save draft & finish later
            </TextLink>
          }
        />
      </form>
    </InsuranceLayout>
  )
}
