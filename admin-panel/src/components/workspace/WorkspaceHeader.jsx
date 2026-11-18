import { useEffect, useRef, useState } from 'react'
import { dashboardIcons as icons } from '../../assets/icons/dashboard'
import { LOCATION_FILTER } from '../../config/workspace'
import { useAuth } from '../../features/auth/context/useAuth'
import Avatar from './Avatar'

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

function ProfileMenu() {
  const { user, organisation, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState('')
  const ref = useRef(null)
  const roleLabel = organisation?.roles.map((role) => role.name).join(', ') || 'No role assigned'

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

  const signOutEverywhere = async () => {
    setFailure('')
    try {
      await signOut({ everywhere: true })
    } catch (error) {
      setFailure(error.message)
    }
  }

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2.5 rounded-xl border border-outline-variant/50 bg-white py-[5px] pr-[9px] pl-[7px] text-left"
      >
        <span className="relative size-8 shrink-0">
          <Avatar initials={initialsOf(user.fullName)} tone="teal" size="sm" className="size-8 rounded-xl" />
          <span className="absolute right-0 bottom-0 size-2.5 rounded-xl bg-emerald-500 ring-2 ring-white" />
        </span>
        <span className="hidden flex-col pr-1 lg:flex">
          <span className="text-xs leading-[15px] font-semibold tracking-[0.48px] text-on-surface">{user.fullName}</span>
          <span className="text-[10px] leading-[10px] text-outline">{roleLabel}</span>
        </span>
        <img src={icons.profileChevron} alt="" className="hidden lg:block" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-outline-variant/60 bg-white p-2 text-xs shadow-lg">
          <div className="border-b border-outline-variant/50 px-2 pt-1 pb-2">
            <p className="font-semibold text-on-surface">{user.fullName}</p>
            <p className="truncate text-outline">{user.email}</p>
            {organisation && <p className="mt-1 text-on-surface-variant">{organisation.organisation.name}</p>}
          </div>
          <button type="button" role="menuitem" onClick={() => signOut()} className="mt-1 w-full rounded px-2 py-2 text-left font-medium text-on-surface hover:bg-surface-low">
            Sign out
          </button>
          <button type="button" role="menuitem" onClick={signOutEverywhere} className="w-full rounded px-2 py-2 text-left font-medium text-danger hover:bg-red-50">
            Sign out of all devices
          </button>
          {failure && (
            <p role="alert" className="px-2 pt-1 text-rose-600">
              {failure}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="relative flex items-center justify-center rounded p-2 transition-colors hover:bg-surface-low"
      {...props}
    >
      {children}
    </button>
  )
}

export default function WorkspaceHeader({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-outline-variant/60 bg-white/90 px-4 font-inter shadow-sm backdrop-blur-[6px] lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="flex size-9 shrink-0 flex-col items-center justify-center gap-1 rounded hover:bg-surface-low lg:hidden"
        >
          <span className="h-0.5 w-4 rounded bg-on-surface" />
          <span className="h-0.5 w-4 rounded bg-on-surface" />
          <span className="h-0.5 w-4 rounded bg-on-surface" />
        </button>

        <button
          type="button"
          className="hidden shrink-0 items-center gap-1.5 rounded border border-outline-variant/50 bg-surface-low px-[13px] py-[7px] text-xs leading-4 font-semibold text-on-surface md:flex"
        >
          <img src={icons.location} alt="" />
          {LOCATION_FILTER}
          <img src={icons.chevronDown} alt="" />
        </button>

        <div className="relative hidden max-w-md min-w-0 flex-1 sm:block">
          <img src={icons.search} alt="" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Search"
            placeholder="Search patients, appointments, invoices... (⌘K)"
            className="w-full rounded border border-outline-variant/60 bg-surface-lowest py-[7px] pr-[49px] pl-[37px] text-xs font-medium tracking-[0.12px] text-on-surface outline-none placeholder:text-outline focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm border border-outline-variant bg-surface-high px-[7px] py-[3px] font-inter text-[10px] leading-[15px] font-bold text-outline">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <IconButton label="Notifications (3 unread)">
          <img src={icons.bell} alt="" />
          <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-xl bg-danger text-[10px] leading-[15px] font-bold text-white ring-2 ring-white">
            3
          </span>
        </IconButton>
        <span className="hidden sm:block">
          <IconButton label="Help documentation">
            <img src={icons.help} alt="" />
          </IconButton>
        </span>
        <span className="hidden h-6 w-px bg-outline-variant/60 sm:block" aria-hidden="true" />
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded border border-red-200 px-[13px] py-[7px] text-xs leading-4 font-semibold text-danger transition-colors hover:bg-red-50 md:flex"
        >
          <img src={icons.emergency} alt="" />
          Emergency Intake
        </button>
        <ProfileMenu />
      </div>
    </header>
  )
}
