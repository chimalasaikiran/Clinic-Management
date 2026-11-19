import { useState } from 'react'
import WorkspaceLayout from '../../../components/workspace/WorkspaceLayout'
import { ROUTES } from '../../../config/routes'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { formatLongDate, localToday } from '../../patients/format'
import DashboardFooter from '../components/sections/DashboardFooter'
import FinancialSnapshot from '../components/sections/FinancialSnapshot'
import KeyMetrics from '../components/sections/KeyMetrics'
import LocationPerformance from '../components/sections/LocationPerformance'
import NeedsAttention from '../components/sections/NeedsAttention'
import PageHeader from '../components/sections/PageHeader'
import QuickActions from '../components/sections/QuickActions'
import RecentActivity from '../components/sections/RecentActivity'
import SetupChecklist from '../components/sections/SetupChecklist'
import TeamStatus from '../components/sections/TeamStatus'
import TodaysOperations from '../components/sections/TodaysOperations'
import {
  activity, attentionItems, clinicHour, dayOptions, finance, greeting, keyMetrics, locations, operations, QUICK_ACTIONS,
  relativeTime, setupChecklist, teamStatus,
} from '../dashboardView'
import { useDashboard } from '../useDashboard'

const DEVICE_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone
const SETUP_HIDDEN_KEY = 'clinicos.dashboard.setupHidden'

// Hiding the setup guide is a per-browser convenience; without storage it simply shows again next time.
const readHidden = (orgId) => {
  try {
    return window.localStorage.getItem(`${SETUP_HIDDEN_KEY}:${orgId}`) === '1'
  } catch {
    return false
  }
}
const writeHidden = (orgId) => {
  try {
    window.localStorage.setItem(`${SETUP_HIDDEN_KEY}:${orgId}`, '1')
  } catch {
    // storage blocked: the guide stays hidden until the page reloads
  }
}

const timeOf = (instant, timeZone) => new Date(instant).toLocaleTimeString('en-US', { timeZone, hour: '2-digit', minute: '2-digit' })

export default function DashboardPage() {
  const { user, orgId, can } = useAuth()
  const { view, error, loading, reload, date, setDate, branchId, setBranchId, syncedAt, now } = useDashboard()
  const [setupHidden, setSetupHidden] = useState(() => readHidden(orgId))

  const timeZone = view?.timeZone ?? DEVICE_ZONE
  const today = view?.today ?? localToday()
  const shownDate = date ?? today
  const branches = view?.branches ?? []
  const meta = {
    eyebrow: 'Owner workspace · Operational overview',
    telemetry: 'Refreshes every minute',
    greeting: greeting(user?.fullName, clinicHour(now, timeZone)),
    summary: shownDate === today
      ? "Here's how your clinic is doing today across clinical sessions, collections, and team flow."
      : `Here's how your clinic did on ${formatLongDate(shownDate)} across clinical sessions, collections, and team flow.`,
    location: {
      value: branchId,
      onChange: setBranchId,
      options: [{ value: '', label: `All locations (${branches.length})` }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))],
    },
    day: { value: shownDate, onChange: (value) => setDate(value === today ? null : value), options: dayOptions(today) },
    lastSynced: syncedAt ? `Last synced ${relativeTime(new Date(syncedAt).toISOString(), now)}` : 'Not synced yet',
    onRefresh: reload,
    refreshing: loading,
  }

  if (!view) {
    return (
      <WorkspaceLayout>
        <div className="flex flex-col gap-6">
          <PageHeader meta={meta} />
          <LoadingState label="Loading dashboard…" error={loading ? null : error} onRetry={reload} />
        </div>
      </WorkspaceLayout>
    )
  }

  const generatedAt = timeOf(view.generatedAt, timeZone)
  const money = finance(view)
  const team = teamStatus(view, generatedAt)
  const checklist = setupHidden ? null : setupChecklist(view)
  const events = activity(view, now)
  const actions = QUICK_ACTIONS.filter((action) => can(action.permission))
  const footer = {
    product: 'ClinicOS',
    notes: [`Figures for ${formatLongDate(view.date)} as of ${generatedAt}`, `Clinic time zone: ${view.timeZone}`],
    links: [can('reports.view') && { label: 'Reports', to: ROUTES.reports }, can('settings.roles') && { label: 'Role management', to: ROUTES.roles }].filter(Boolean),
  }

  return (
    <WorkspaceLayout>
      <div className="flex flex-col gap-6">
        <PageHeader meta={meta} />
        {error && <LoadingState error={error} onRetry={reload} />}
        <KeyMetrics metrics={keyMetrics(view)} />
        <NeedsAttention items={attentionItems(view)} />
        {view.appointments && <TodaysOperations operations={operations(view.appointments)} />}

        {(money || team) && (
          <div className={money && team ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : 'grid grid-cols-1 gap-6'}>
            {money && <FinancialSnapshot finance={money} />}
            {team && <TeamStatus team={team} />}
          </div>
        )}

        <LocationPerformance locations={locations(view)} onOpen={setBranchId} />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <RecentActivity
              events={events}
              note={events ? 'No activity recorded yet.' : 'Recent activity covers the whole organisation, so it is shown to roles that cover every branch.'}
            />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-5">
            {actions.length > 0 && <QuickActions actions={actions} />}
            {checklist && (
              <SetupChecklist
                checklist={checklist}
                onHide={() => {
                  writeHidden(orgId)
                  setSetupHidden(true)
                }}
              />
            )}
          </div>
        </div>

        <DashboardFooter footer={footer} />
      </div>
    </WorkspaceLayout>
  )
}
