import { Link } from 'react-router-dom'
import { dashboardIcons as icons } from '../../../assets/icons/dashboard'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { NAV_ITEMS, SIDEBAR_BRANCH } from '../data/mockDashboardData'

function NavItem({ item }) {
  const content = (
    <>
      <span className="flex w-[15px] shrink-0 justify-center">
        <img src={item.icon} alt="" />
      </span>
      <span className="flex-1 text-base leading-6">{item.label}</span>
      {item.active && <span className="size-1.5 rounded-xl bg-brand" />}
    </>
  )

  if (item.active) {
    return (
      <Link
        to={ROUTES.dashboard}
        aria-current="page"
        className="flex items-center gap-3 rounded border-l-2 border-brand bg-surface-low py-2 pr-3 pl-3.5 font-semibold text-brand"
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded px-3 py-2 text-left font-normal text-on-surface-variant transition-colors hover:bg-surface-low',
      )}
    >
      {content}
    </button>
  )
}

export default function Sidebar({ className }) {
  return (
    <aside className={cn('h-full w-64 border-r border-outline-variant/60 bg-white font-inter', className)}>
      <div className="flex h-full flex-col justify-between p-4">
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-3 px-2 pt-1 pb-2">
          <span className="flex h-9 w-[28.64px] shrink-0 items-center justify-center rounded bg-black shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.05)]">
            <img src={icons.logoSidebar} alt="" />
          </span>
          <div className="flex flex-col">
            <span className="font-sans text-base leading-[22px] font-semibold tracking-[-0.4px] text-on-surface">
              ClinicOS Sovereign
            </span>
            <span className="text-xs leading-4 font-semibold tracking-[0.6px] text-outline uppercase">
              Executive operating
              <br />
              system
            </span>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-black px-3 py-2 text-sm leading-5 font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <img src={icons.plusNew} alt="" />
          New Encounter
        </button>

        <nav aria-label="Primary" className="mt-4 flex flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-2 border-t border-outline-variant/50 pt-[13px]">
        <div className="flex items-center justify-between rounded border border-outline-variant/40 bg-surface-low px-[11px] py-[9px]">
          <div className="flex flex-col">
            <span className="text-xs leading-4 font-semibold tracking-[0.48px] text-on-surface">
              {SIDEBAR_BRANCH.name}
            </span>
            <span className="text-[13px] leading-5 tracking-[0.065px] text-outline">{SIDEBAR_BRANCH.scope}</span>
          </div>
          <button type="button" aria-label="Switch branch" className="px-1 py-1.5">
            <img src={icons.branchSwitch} alt="" />
          </button>
        </div>

        <div className="flex flex-col text-xs leading-4 text-on-surface-variant">
          <button type="button" className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left hover:bg-surface-low">
            <img src={icons.support} alt="" />
            Support
          </button>
          <div className="mt-0.5 flex items-center justify-between px-2.5 py-1.5">
            <span className="flex items-center gap-2">
              <img src={icons.systemHealth} alt="" />
              System Health
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand">
              <span className="size-1.5 rounded-xl bg-brand" />
              {SIDEBAR_BRANCH.uptime}
            </span>
          </div>
        </div>
      </div>
      </div>
    </aside>
  )
}
