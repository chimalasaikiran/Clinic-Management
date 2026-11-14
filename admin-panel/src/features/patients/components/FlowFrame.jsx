import { CalendarX } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import EmptyState from './EmptyState'
import PatientNotFound from './PatientNotFound'

// Full-page frame for the appointment and encounter flows: title row, then content.
export default function FlowFrame({ title, badge, description, actions, children }) {
  return (
    <WorkspacePage>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl flex-1 basis-96">
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-bold tracking-tight text-on-surface">
            {title}
            {badge}
          </h1>
          {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </WorkspacePage>
  )
}

// What a flow page renders when its patient or appointment cannot be found.
export function FlowMissing({ patient, what = 'appointment' }) {
  if (!patient) {
    return (
      <WorkspacePage>
        <PatientNotFound />
      </WorkspacePage>
    )
  }
  return (
    <WorkspacePage>
      <EmptyState icon={CalendarX} title={`This ${what} could not be found`} action={<ActionButton to={pathFor(ROUTES.patientAppointments, { patientId: patient.id })}>Back to appointments</ActionButton>}>
        The {what} may have been removed, or the link is incorrect. Open it again from {patient.name}&apos;s appointments.
      </EmptyState>
    </WorkspacePage>
  )
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 hover:bg-slate-50">
      ← {children}
    </Link>
  )
}
