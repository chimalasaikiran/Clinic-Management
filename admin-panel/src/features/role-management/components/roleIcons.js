import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarCheck,
  ChartColumn,
  ConciergeBell,
  Contact,
  LayoutDashboard,
  Receipt,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Store,
} from 'lucide-react'

export const GROUP_ICONS = {
  dashboard: LayoutDashboard,
  branches: Building2,
  bookings: CalendarCheck,
  staff: Contact,
  therapists: Stethoscope,
  accounting: Receipt,
  reports: ChartColumn,
  settings: Settings2,
}

export const CATEGORY_ICONS = {
  Administration: ShieldCheck,
  Operations: Store,
  Physiotherapy: Activity,
  'Reception / Front Office': ConciergeBell,
  Finance: Receipt,
  'HR & Compliance': BadgeCheck,
}

export const STATUS_TONES = { Active: 'success', Inactive: 'neutral', Draft: 'warning' }
