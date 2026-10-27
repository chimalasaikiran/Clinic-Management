import { dashboardIcons as icons } from '../../../assets/icons/dashboard'
import { images } from '../../../assets/images'
import { OWNER, PAGE_META } from '../data/mockDashboardData'

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

export default function DashboardHeader({ onMenuClick }) {
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
          {PAGE_META.locationFilter}
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
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-xl border border-outline-variant/50 bg-white py-[5px] pr-[9px] pl-[7px] text-left"
        >
          <span className="relative size-8 shrink-0">
            <img
              src={images.ownerAvatar}
              alt=""
              className="size-8 rounded-xl border border-outline-variant/80 object-cover"
            />
            <span className="absolute right-0 bottom-0 size-2.5 rounded-xl bg-emerald-500 ring-2 ring-white" />
          </span>
          <span className="hidden flex-col pr-1 lg:flex">
            <span className="text-xs leading-[15px] font-semibold tracking-[0.48px] text-on-surface">{OWNER.name}</span>
            <span className="text-[10px] leading-[10px] text-outline">{OWNER.role}</span>
          </span>
          <img src={icons.profileChevron} alt="" className="hidden lg:block" />
        </button>
      </div>
    </header>
  )
}
