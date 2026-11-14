import { LayoutGrid } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { formatINR } from '../format'
import { ledgerSummary } from '../billing'
import { isUpcoming } from '../selectors'
import { usePatient } from '../context/usePatient'
import PatientHeader from './PatientHeader'
import PatientNotFound from './PatientNotFound'

function TabBadge({ children, tone = 'dark' }) {
  return (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold', tone === 'dark' ? 'bg-slate-700 text-white' : tone === 'warn' ? 'bg-amber-100 text-amber-800' : tone === 'brand' ? 'bg-brand text-white' : 'bg-teal-100 text-brand')}>
      {children}
    </span>
  )
}

// Frame for every /patients/:patientId/<tab> page: identity banner, tab strip, then the active tab.
export default function PatientHubLayout() {
  const { patient, patientId, mine } = usePatient()

  if (!patient) {
    return (
      <WorkspacePage>
        <PatientNotFound />
      </WorkspacePage>
    )
  }

  const orders = mine('orders')
  const awaiting = orders.filter((order) => order.status === 'Awaiting Review').length
  const referrals = mine('referrals').filter((referral) => ['Pending Acceptance', 'Awaiting Review'].includes(referral.status)).length
  const activeMeds = mine('prescriptions').filter((rx) => rx.status === 'Active').reduce((count, rx) => count + rx.items.length, 0)
  const summary = ledgerSummary({ invoices: mine('invoices'), payments: mine('payments'), refunds: mine('refunds') })
  const encounters = mine('encounters').length
  const upcoming = mine('appointments').filter(isUpcoming).length
  const family = mine('family').length

  const tabs = [
    { label: 'Overview', to: pathFor(ROUTES.patientHub, { patientId }), end: true, icon: LayoutGrid },
    { label: 'Appointments', to: pathFor(ROUTES.patientAppointments, { patientId }), badge: upcoming ? <TabBadge>{upcoming}</TabBadge> : null },
    { label: 'Encounters', to: pathFor(ROUTES.patientEncounters, { patientId }), badge: encounters ? <TabBadge>{encounters}</TabBadge> : null },
    { label: 'Clinical Records', to: pathFor(ROUTES.patientRecords, { patientId }) },
    { label: 'Prescriptions', to: pathFor(ROUTES.patientPrescriptions, { patientId }), badge: activeMeds ? <TabBadge tone="brand">{activeMeds}</TabBadge> : null },
    { label: 'Orders & Results', to: pathFor(ROUTES.patientOrders, { patientId }), badge: awaiting ? <TabBadge tone="warn">{awaiting} Pending</TabBadge> : null },
    { label: 'Referrals', to: pathFor(ROUTES.patientReferrals, { patientId }), badge: referrals ? <TabBadge tone="soft">{referrals}</TabBadge> : null },
    { label: 'Billing & Invoices', to: pathFor(ROUTES.patientBilling, { patientId }), badge: <TabBadge tone="soft">{formatINR(summary.outstanding)} Due</TabBadge> },
    { label: 'Family & Caregiver', to: pathFor(ROUTES.patientFamily, { patientId }), badge: family ? <TabBadge tone="soft">{family}</TabBadge> : null },
    { label: 'Communication', to: pathFor(ROUTES.patientCommunication, { patientId }) },
  ]

  return (
    <WorkspacePage>
      <PatientHeader />
      <nav aria-label="Patient sections" className="-mt-2 mb-6 overflow-x-auto border-b border-slate-200">
        <ul className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <li key={tab.label}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn('flex items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] font-medium whitespace-nowrap', isActive ? 'border-brand bg-teal-50/60 text-brand' : 'border-transparent text-on-surface-variant hover:text-on-surface')
                }
              >
                {tab.icon && <tab.icon className="size-3.5" aria-hidden="true" />}
                {tab.label}
                {tab.badge}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </WorkspacePage>
  )
}
