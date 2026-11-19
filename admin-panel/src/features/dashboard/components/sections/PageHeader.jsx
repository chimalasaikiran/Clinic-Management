import { dashboardIcons as icons } from '../../../../assets/icons/dashboard'

// Looks like the filter buttons of the design; a native select laid over it does the choosing.
function FilterSelect({ icon, value, options, onChange, name }) {
  const current = options.find((option) => option.value === value) ?? options[0]
  return (
    <label className="relative flex items-center gap-1.5 rounded border border-slate-200 bg-white px-[13px] py-[7px] text-xs leading-4 font-medium text-slate-700 shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-colors focus-within:ring-2 focus-within:ring-brand/30 hover:bg-slate-50">
      <img src={icon} alt="" />
      {current?.label}
      <img src={icons.filterChevron} alt="" />
      <select
        aria-label={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
          <FilterSelect icon={icons.filterLocation} name="Location" {...meta.location} />
          <FilterSelect icon={icons.calendar} name="Day" {...meta.day} />
        </div>
        <div className="flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-[11px] py-[7px] text-xs leading-4 text-slate-500">
          <img src={icons.sync} alt="" />
          <span aria-live="polite">{meta.lastSynced}</span>
          <button type="button" aria-label="Refresh data" onClick={meta.onRefresh} disabled={meta.refreshing} className="ml-1 p-0.5 disabled:animate-spin">
            <img src={icons.refresh} alt="" />
          </button>
        </div>
      </div>
    </header>
  )
}
