import DashboardLayout from '../components/DashboardLayout'
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
  ACTIVITY,
  ATTENTION_ITEMS,
  FINANCE,
  FOOTER,
  KEY_METRICS,
  LOCATIONS,
  OPERATIONS,
  PAGE_META,
  QUICK_ACTIONS,
  SETUP_CHECKLIST,
  TEAM,
} from '../data/mockDashboardData'

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-[960px] flex-col gap-6">
        <PageHeader meta={PAGE_META} />
        <KeyMetrics metrics={KEY_METRICS} />
        <NeedsAttention items={ATTENTION_ITEMS} />
        <TodaysOperations operations={OPERATIONS} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FinancialSnapshot finance={FINANCE} />
          <TeamStatus team={TEAM} />
        </div>

        <LocationPerformance locations={LOCATIONS} />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <RecentActivity events={ACTIVITY} />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <QuickActions actions={QUICK_ACTIONS} />
            <SetupChecklist checklist={SETUP_CHECKLIST} />
          </div>
        </div>

        <DashboardFooter footer={FOOTER} />
      </div>
    </DashboardLayout>
  )
}
