import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarCheck,
  ChartColumn,
  ConciergeBell,
  ClipboardPlus,
  Contact,
  LayoutDashboard,
  Megaphone,
  Package,
  Pill,
  Receipt,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Users,
  Store,
} from 'lucide-react'

export const GROUP_ICONS = {
  dashboard: LayoutDashboard,
  branches: Building2,
  bookings: CalendarCheck,
  patients: Users,
  clinical: ClipboardPlus,
  staff: Contact,
  therapists: Stethoscope,
  accounting: Receipt,
  pharmacy: Pill,
  inventory: Package,
  reports: ChartColumn,
  growth: Megaphone,
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
