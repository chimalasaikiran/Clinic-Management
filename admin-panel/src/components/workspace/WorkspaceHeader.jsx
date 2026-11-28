import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { dashboardIcons as icons } from '../../assets/icons/dashboard'
import { ROUTES } from '../../config/routes'
import { useAuth } from '../../features/auth/context/useAuth'
import { workspaceApi } from '../../features/workspace/api'
import { useReadAlerts } from '../../features/workspace/useReadAlerts'
import { useWorkspace } from '../../features/workspace/useWorkspace'
import { alertItems, locationOptions, noticeItems, searchGroups } from '../../features/workspace/workspaceView'
import { useApiResource } from '../../hooks/useApiResource'
import Avatar from './Avatar'

const SEARCH_DELAY_MS = 250
const SEARCH_PERMISSIONS = ['patients.view', 'bookings.view', 'accounting.invoices']
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')
const SHORTCUT = IS_MAC ? '⌘K' : 'Ctrl K'

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

// Closes a menu on a click outside `ref` or on Escape.
function useDismiss(ref, open, close) {
  const onClose = useRef(close)
  useEffect(() => {
    onClose.current = close
  })
  useEffect(() => {
    if (!open) return undefined
    const onEvent = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) onClose.current()
    }
    document.addEventListener('mousedown', onEvent)
    document.addEventListener('keydown', onEvent)
    return () => {
      document.removeEventListener('mousedown', onEvent)
      document.removeEventListener('keydown', onEvent)
    }
  }, [ref, open])
}

function ProfileMenu() {
  const { user, organisation, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [failure, setFailure] = useState('')
  const ref = useRef(null)
  const roleLabel = organisation?.roles.map((role) => role.name).join(', ') || 'No role assigned'
  useDismiss(ref, open, () => setOpen(false))

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

// The branch the workspace is working in. The styled button stays as designed; a native select laid over it
// does the choosing, so it works with the keyboard and screen readers.
function LocationFilter() {
  const { organisation } = useAuth()
  const { branches, branchesLoaded, branchId, setBranchId } = useWorkspace()
  const options = locationOptions(branches, organisation?.branchScope)
  const label = !branchesLoaded ? 'Loading locations…' : (options.find((option) => option.value === branchId)?.label ?? options[0]?.label ?? 'No locations')

  return (
    <div className="relative hidden shrink-0 md:flex">
      <span className="flex items-center gap-1.5 rounded border border-outline-variant/50 bg-surface-low px-[13px] py-[7px] text-xs leading-4 font-semibold text-on-surface">
        <img src={icons.location} alt="" />
        {label}
        <img src={icons.chevronDown} alt="" />
      </span>
      <select
        aria-label="Working location"
        value={branchId}
        disabled={!branchesLoaded || options.length < 2}
        onChange={(event) => setBranchId(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        {options.map((option) => (
          <option key={option.value || 'all'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// Finds patients, appointments and invoices from anywhere in the workspace; ⌘K / Ctrl K jumps here.
function SearchBox() {
  const navigate = useNavigate()
  const listId = useId()
  const inputRef = useRef(null)
  const ref = useRef(null)
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  useDismiss(ref, open, () => setOpen(false))

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(text.trim())
      setActive(0)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const ready = query.length >= 2
  const results = useApiResource(() => (ready ? workspaceApi.search(query) : Promise.resolve(null)), `search:${query}`)
  const settled = ready && query === text.trim() && !results.loading
  const groups = settled && results.data?.query === query ? searchGroups(results.data) : []
  const items = groups.flatMap((group) => group.items)
  const shown = open && text.trim().length >= 2
  const current = Math.min(active, Math.max(items.length - 1, 0))

  const go = (item) => {
    setOpen(false)
    setText('')
    navigate(item.to)
  }

  const onKeyDown = (event) => {
    if (!items.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActive((current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length)
    } else if (event.key === 'Enter' && shown) {
      event.preventDefault()
      go(items[current])
    }
  }

  let status = null
  if (shown && !settled) status = 'Searching…'
  else if (shown && results.error) status = results.error.message
  else if (shown && !items.length) status = `No patients, appointments or invoices match “${query}”.`

  return (
    <div ref={ref} className="relative hidden max-w-md min-w-0 flex-1 sm:block">
      <img src={icons.search} alt="" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search"
        aria-expanded={shown && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && items.length ? `${listId}-${current}` : undefined}
        placeholder={`Search patients, appointments, invoices... (${SHORTCUT})`}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded border border-outline-variant/60 bg-surface-lowest py-[7px] pr-[49px] pl-[37px] text-xs font-medium tracking-[0.12px] text-on-surface outline-none placeholder:text-outline focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm border border-outline-variant bg-surface-high px-[7px] py-[3px] font-inter text-[10px] leading-[15px] font-bold text-outline">
        {SHORTCUT}
      </kbd>

      {shown && (
        <div className="absolute inset-x-0 z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-outline-variant/60 bg-white p-2 text-xs shadow-lg">
          {status && (
            <p role="status" className="px-2 py-2 text-on-surface-variant">
              {status}
            </p>
          )}
          <ul id={listId} role="listbox" aria-label="Search results">
            {!status &&
              groups.map((group) => (
                <li key={group.id} role="presentation" className="mb-1">
                  <p className="px-2 pt-1 pb-1 text-[10px] font-semibold tracking-[0.6px] text-outline uppercase">{group.label}</p>
                  <ul role="group" aria-label={group.label}>
                    {group.items.map((item) => {
                      const index = items.indexOf(item)
                      return (
                        <li
                          key={item.key}
                          id={`${listId}-${index}`}
                          role="option"
                          aria-selected={index === current}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => go(item)}
                          onMouseEnter={() => setActive(index)}
                          className={`cursor-pointer rounded px-2 py-2 ${index === current ? 'bg-surface-low' : ''}`}
                        >
                          <p className="font-semibold text-on-surface">{item.title}</p>
                          <p className="text-outline">{item.detail}</p>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Open items the person can act on (from /v1/alerts), each linking to where it is handled.
function AlertsMenu() {
  const { user, orgId } = useAuth()
  const { alerts, alertsError, reloadAlerts, branchId, notifications, reloadNotifications } = useWorkspace()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const items = alertItems(alerts)
  // While another branch is loading, the previous branch's items are still held; they say nothing about this one.
  const current = alerts && (alerts.branchId ?? '') === branchId ? alerts.items : null
  const { unread, markAllRead } = useReadAlerts(`clinicos.alerts.read:${user?.id}:${orgId}:${branchId}`, current)
  const notices = noticeItems(notifications)
  const unreadNotices = notifications?.meta?.unread ?? 0
  const count = items.filter((item) => unread.has(item.id)).length + unreadNotices
  const label = count ? `Alerts (${count} unread)` : 'Alerts'
  // Closing the list is what marks it read, so new items stay highlighted while it is open.
  const close = () => {
    setOpen(false)
    markAllRead()
    // A failure leaves them unread, so they are offered again.
    if (unreadNotices) workspaceApi.markNotificationsRead({ all: true }).then(reloadNotifications, () => {})
  }
  useDismiss(ref, open, close)

  return (
    <div ref={ref} className="relative">
      <IconButton
        label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          if (open) return close()
          // Opening the list asks for the latest items rather than waiting for the next refresh.
          reloadAlerts()
          reloadNotifications()
          return setOpen(true)
        }}
      >
        <Bell className="size-5 text-on-surface" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </IconButton>

      {open && (
        <div role="region" aria-label="Alerts" className="absolute right-0 z-30 mt-2 max-h-[70vh] overflow-y-auto w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-outline-variant/60 bg-white p-2 text-xs shadow-lg">
          <p className="border-b border-outline-variant/50 px-2 pt-1 pb-2 font-semibold text-on-surface">Needs your attention</p>
          {alertsError && (
            <p role="alert" className="px-2 pt-2 text-danger">
              {alerts ? 'This list may be out of date. ' : 'Alerts could not be loaded. '}
              <button type="button" onClick={reloadAlerts} className="font-semibold text-brand hover:underline">
                Try again
              </button>
            </p>
          )}
          {!alerts ? (
            alertsError ? null : (
            <p className="px-2 py-3 text-on-surface-variant">Checking for open items…</p>
            )
          ) : items.length === 0 ? (
            <p className="px-2 py-3 text-on-surface-variant">Nothing needs your attention right now.</p>
          ) : (
            <ul className="mt-1 flex flex-col">
              {items.map((item) => (
                <li key={item.id}>
                  <Link to={item.to} onClick={close} className="block rounded px-2 py-2 hover:bg-surface-low">
                    <span className={`flex items-center justify-between gap-2 ${unread.has(item.id) ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>
                      {item.title}
                      {unread.has(item.id) && <span className="shrink-0 rounded-full bg-teal-50 px-1.5 text-[10px] font-semibold text-brand">New</span>}
                    </span>
                    <span className="block text-outline">{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {notices.length > 0 && (
            <>
              <p className="mt-1 border-t border-b border-outline-variant/50 px-2 py-2 font-semibold text-on-surface">Recent activity</p>
              <ul aria-label="Recent activity" className="mt-1 flex flex-col">
                {notices.map((item) => (
                  <li key={item.id}>
                    <Link to={item.to} onClick={close} className="block rounded px-2 py-2 hover:bg-surface-low">
                      <span className={`flex items-center justify-between gap-2 ${item.unread ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>
                        {item.title}
                        {item.unread && <span className="shrink-0 rounded-full bg-teal-50 px-1.5 text-[10px] font-semibold text-brand">New</span>}
                      </span>
                      <span className="block text-outline">{item.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function WorkspaceHeader({ onMenuClick }) {
  const { can, canAny } = useAuth()
  const intake = can('bookings.view') && can('bookings.create')

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

        <LocationFilter />
        {canAny(SEARCH_PERMISSIONS) && <SearchBox />}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <AlertsMenu />
        {intake && (
          <>
            <span className="hidden h-6 w-px bg-outline-variant/60 sm:block" aria-hidden="true" />
            <Link
              to={`${ROUTES.appointments}?walkIn=emergency`}
              className="hidden items-center gap-1.5 rounded border border-red-200 px-[13px] py-[7px] text-xs leading-4 font-semibold text-danger transition-colors hover:bg-red-50 md:flex"
            >
              <img src={icons.emergency} alt="" />
              Emergency Intake
            </Link>
          </>
        )}
        <ProfileMenu />
      </div>
    </header>
  )
}
