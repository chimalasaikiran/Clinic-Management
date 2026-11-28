import { useAuth } from '../../auth/context/useAuth'
import { dashboardKind } from '../day/dayView'
import DoctorDashboard from '../day/DoctorDashboard'
import NurseDashboard from '../day/NurseDashboard'
import ReceptionDashboard from '../day/ReceptionDashboard'
import OverviewDashboard from './OverviewDashboard'

const DASHBOARDS = { overview: OverviewDashboard, doctor: DoctorDashboard, nurse: NurseDashboard, reception: ReceptionDashboard }

export default function DashboardPage() {
  const { can } = useAuth()
  const Dashboard = DASHBOARDS[dashboardKind(can)]
  return <Dashboard />
}
