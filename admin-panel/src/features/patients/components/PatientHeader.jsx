import { BadgeCheck, CalendarClock, Droplet, Building2, Pencil, Phone, Stethoscope, Users, FileSignature, History, CalendarPlus, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import Avatar from '../../../components/workspace/Avatar'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { formatDate, formatTime } from '../format'
import { daysLabel, lastCompletedVisit, nextAppointment, startEncounterPath } from '../selectors'
import { usePatient } from '../context/usePatient'

function SummaryCard({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-surface-lowest p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded bg-white text-brand">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</p>
        {children}
      </div>
    </div>
  )
}

// Identity banner shared by every patient hub tab.
export default function PatientHeader() {
  const { patient, patientId, mine } = usePatient()
  const navigate = useNavigate()
  const appointments = mine('appointments')
  const last = lastCompletedVisit(appointments)
  const next = nextAppointment(appointments)
  const allergyCount = mine('allergies').length

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-start gap-5">
          <Avatar initials={patient.initials} tone="slate" size="lg" className="size-20 text-2xl" />
          <div className="min-w-0">
            <h1 className="text-[34px] leading-10 font-bold tracking-tight text-on-surface">{patient.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
              <span className="rounded bg-surface-low px-1.5 py-0.5 font-mono text-xs text-on-surface">{patient.mrn}</span>
              {patient.age} yrs · {patient.gender}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill tone={patient.status === 'Active' ? 'success' : 'neutral'}>
                <BadgeCheck className="size-3" aria-hidden="true" />
                {patient.status} · Verified
              </StatusPill>
              <StatusPill tone="brand" className="font-mono">
                <ShieldCheck className="size-3" aria-hidden="true" />
                ABHA: {patient.abha}
              </StatusPill>
            </p>
          </div>
          <dl className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 text-outline" aria-hidden="true" />
              <dt className="sr-only">Mobile</dt>
              <dd className="font-medium text-on-surface">
                {patient.mobile} <span className="font-normal text-brand">({patient.contactNote})</span>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="size-3.5 text-outline" aria-hidden="true" />
              <dt>Primary Branch:</dt>
              <dd className="font-medium text-on-surface">{patient.branch}</dd>
            </div>
            <div className="flex items-center gap-2">
              <History className="size-3.5 text-outline" aria-hidden="true" />
              <dt>Reg. Date:</dt>
              <dd className="font-medium text-on-surface">{formatDate(patient.regDate)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Droplet className="size-3.5 text-outline" aria-hidden="true" />
              <dt>Blood Group:</dt>
              <dd className="font-medium text-on-surface">{patient.bloodGroup}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton icon={Pencil} to={pathFor(ROUTES.patientEdit, { patientId })}>Edit</ActionButton>
          <ActionButton icon={Stethoscope} onClick={() => navigate(startEncounterPath(patient.id, appointments))}>Start Encounter</ActionButton>
          <ActionButton variant="primary" icon={CalendarPlus} to={pathFor(ROUTES.appointmentNew, { patientId })}>Book appointment</ActionButton>
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={History} label="Last visit">
          {last ? (
            <>
              <p className="text-[13px] font-semibold text-on-surface">{formatDate(last.date)} ({daysLabel(last.date).toLowerCase()})</p>
              <p className="text-[11px] text-on-surface-variant">{last.doctorShort} · {last.specialty}</p>
            </>
          ) : (
            <p className="text-[13px] font-semibold text-on-surface-variant">No visits recorded</p>
          )}
        </SummaryCard>
        <SummaryCard icon={CalendarClock} label="Next appointment">
          {next ? (
            <>
              <p className="text-[13px] font-semibold text-on-surface">{formatDate(next.date)}, {formatTime(next.time)}</p>
              <p className="text-[11px] text-on-surface-variant">{next.doctorShort} · {next.service}</p>
            </>
          ) : (
            <p className="text-[13px] font-semibold text-on-surface-variant">Nothing scheduled</p>
          )}
        </SummaryCard>
        <SummaryCard icon={Users} label="Care team">
          <p className="text-[13px] font-semibold text-on-surface">{patient.careTeam ?? 'Not assigned'}</p>
          {patient.careTeamNote && <p className="text-[11px] text-on-surface-variant">{patient.careTeamNote}</p>}
        </SummaryCard>
        <SummaryCard icon={FileSignature} label="Consent & governance">
          <p className="text-[13px] font-semibold text-brand">{patient.consent}</p>
          <p className="text-[11px] text-on-surface-variant">{allergyCount ? `${allergyCount} allergies flagged` : 'No allergies documented'}</p>
        </SummaryCard>
      </div>
    </section>
  )
}
