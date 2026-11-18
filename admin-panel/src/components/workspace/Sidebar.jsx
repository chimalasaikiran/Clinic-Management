import { Link, useLocation } from 'react-router-dom'
import { dashboardIcons as icons } from '../../assets/icons/dashboard'
import { canOpen } from '../../config/access'
import { NAV_ITEMS, SIDEBAR_BRANCH } from '../../config/workspace'
import { useAuth } from '../../features/auth/context/useAuth'
import { cn } from '../../lib/cn'

function NavItem({ item }) {
  const { pathname } = useLocation()
  const active = Boolean(item.match) && pathname.startsWith(item.match)

  const content = (
    <>
      <span className="flex w-[15px] shrink-0 justify-center">
        <img src={item.icon} alt="" />
      </span>
      <span className="flex-1 text-base leading-6">{item.label}</span>
      {active && <span className="size-1.5 rounded-xl bg-brand" />}
    </>
  )

  if (active) {
    return (
      <>
        <Link
          to={item.to}
          aria-current={item.children ? undefined : 'page'}
          className="flex items-center gap-3 rounded border-l-2 border-brand bg-surface-low py-2 pr-3 pl-3.5 font-semibold text-brand"
        >
          {content}
        </Link>
        {item.children && (
          <ul aria-label={`${item.label} sections`} className="mb-1 ml-[22px] flex flex-col gap-0.5 border-l border-outline-variant/60 pl-2">
            {item.children.map((child) => {
              const current = pathname.startsWith(child.match)
              return (
                <li key={child.label}>
                  <Link
                    to={child.to}
                    aria-current={current ? 'page' : undefined}
                    className={cn('block rounded px-3 py-1.5 text-sm', current ? 'bg-surface-low font-semibold text-brand' : 'text-on-surface-variant hover:bg-surface-low')}
                  >
                    {child.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </>
    )
  }

  const rowClass = 'flex w-full items-center gap-3 rounded px-3 py-2 text-left font-normal text-on-surface-variant transition-colors hover:bg-surface-low'

  // Sections that are not built yet stay as inert buttons.
  return item.to ? (
    <Link to={item.to} className={rowClass}>
      {content}
    </Link>
  ) : (
    <button type="button" className={rowClass}>
      {content}
    </button>
  )
}

export default function Sidebar({ className }) {
  // Sections the user's role cannot open are hidden; the route guard and the API enforce the same rule.
  const { can } = useAuth()

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
          {NAV_ITEMS.filter((item) => canOpen(item.to, can)).map((item) => (
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
