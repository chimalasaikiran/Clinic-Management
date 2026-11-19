import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { dashboardIcons as icons } from '../../assets/icons/dashboard'
import { canOpen, homePath } from '../../config/access'
import { ROUTES } from '../../config/routes'
import { NAV_ITEMS } from '../../config/workspace'
import { useAuth } from '../../features/auth/context/useAuth'
import { useWorkspace } from '../../features/workspace/useWorkspace'
import { healthStatus, scopeLabel } from '../../features/workspace/workspaceView'
import { cn } from '../../lib/cn'

// The organisation in use and how much of it the person's roles cover. With more than one organisation the
// switch button lists the others; the person lands on the first page their role there can open.
function OrganisationCard() {
  const { organisation, memberships, orgId, selectOrganisation } = useAuth()
  const { branches, branchesLoaded } = useWorkspace()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const others = memberships.filter((entry) => entry.organisation.id !== orgId)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const switchTo = (entry) => {
    const held = new Set(entry.permissions)
    setOpen(false)
    selectOrganisation(entry.organisation.id)
    navigate(homePath((permission) => held.has(permission)) ?? ROUTES.dashboard)
  }

  if (!organisation) return null

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center justify-between rounded border border-outline-variant/40 bg-surface-low px-[11px] py-[9px]">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-xs leading-4 font-semibold tracking-[0.48px] text-on-surface">{organisation.organisation.name}</span>
          <span className="text-[13px] leading-5 tracking-[0.065px] text-outline">{branchesLoaded ? scopeLabel(organisation.branchScope, branches.length) : 'Loading locations…'}</span>
        </div>
        {others.length > 0 && (
          <button type="button" aria-label="Switch organisation" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="px-1 py-1.5">
            <img src={icons.branchSwitch} alt="" />
          </button>
        )}
      </div>
      {open && (
        <div role="menu" aria-label="Organisations" className="absolute inset-x-0 bottom-full z-30 mb-2 rounded-xl border border-outline-variant/60 bg-white p-2 text-xs shadow-lg">
          {others.map((entry) => (
            <button key={entry.organisation.id} type="button" role="menuitem" onClick={() => switchTo(entry)} className="w-full rounded px-2 py-2 text-left hover:bg-surface-low">
              <span className="block font-semibold text-on-surface">{entry.organisation.name}</span>
              <span className="block text-outline">{entry.roles.map((role) => role.name).join(', ') || 'No role assigned'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const HEALTH_TONE = { brand: 'text-brand', danger: 'text-danger', neutral: 'text-outline' }
const HEALTH_DOT = { brand: 'bg-brand', danger: 'bg-danger', neutral: 'bg-outline' }

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

  return (
    <Link to={item.to} className={rowClass}>
      {content}
    </Link>
  )
}

export default function Sidebar({ className }) {
  // Sections the user's role cannot open are hidden; the route guard and the API enforce the same rule.
  const { can } = useAuth()
  const health = healthStatus(useWorkspace().health)

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

        {can('bookings.view') && can('bookings.create') && (
          <Link
            to={`${ROUTES.appointments}?walkIn=1`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-black px-3 py-2 text-sm leading-5 font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <img src={icons.plusNew} alt="" />
            New Encounter
          </Link>
        )}

        <nav aria-label="Primary" className="mt-4 flex flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.filter((item) => canOpen(item.to, can)).map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-2 border-t border-outline-variant/50 pt-[13px]">
        <OrganisationCard />

        <div className="flex flex-col text-xs leading-4 text-on-surface-variant">
          <div className="mt-0.5 flex items-center justify-between px-2.5 py-1.5">
            <span className="flex items-center gap-2">
              <img src={icons.systemHealth} alt="" />
              System Health
            </span>
            <span className={cn('flex items-center gap-1.5 text-[11px] font-medium', HEALTH_TONE[health.tone])}>
              <span className={cn('size-1.5 rounded-xl', HEALTH_DOT[health.tone])} />
              {health.label}
            </span>
          </div>
        </div>
      </div>
      </div>
    </aside>
  )
}
