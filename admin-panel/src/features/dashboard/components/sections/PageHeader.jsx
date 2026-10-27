import { dashboardIcons as icons } from '../../../../assets/icons/dashboard'

function FilterButton({ icon, children }) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-[13px] py-[7px] text-xs leading-4 font-medium text-slate-700 shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-colors hover:bg-slate-50"
    >
      <img src={icon} alt="" />
      {children}
      <img src={icons.filterChevron} alt="" />
    </button>
  )
}

export default function PageHeader({ meta }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-slate-200 pb-[17px]">
      <div className="flex max-w-[522px] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-brand/10 px-2 py-0.5 text-[11px] leading-[16.5px] font-semibold tracking-[0.55px] text-brand uppercase">
            {meta.eyebrow}
          </span>
          <span className="flex items-center gap-1 text-[11px] leading-[16.5px] font-medium text-slate-500">
            <span className="size-1.5 rounded-xl bg-emerald-500" />
            {meta.telemetry}
          </span>
        </div>
        <h1 className="font-sans text-2xl leading-10 font-semibold tracking-[-0.8px] text-slate-900 sm:text-[32px]">
          {meta.greeting}
        </h1>
        <p className="text-[15px] leading-6 text-slate-600">{meta.summary}</p>
      </div>

      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-wrap gap-3">
          <FilterButton icon={icons.filterLocation}>{meta.locationFilter}</FilterButton>
          <FilterButton icon={icons.calendar}>{meta.dateFilter}</FilterButton>
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-[11px] py-[7px] text-xs leading-4 text-slate-500">
          <img src={icons.sync} alt="" />
          {meta.lastSynced}
          <button type="button" aria-label="Refresh data" className="ml-1 p-0.5">
            <img src={icons.refresh} alt="" />
          </button>
        </div>
      </div>
    </header>
  )
}
