import { dashboardIcons as icons } from '../../../../assets/icons/dashboard'
import { cn } from '../../../../lib/cn'
import { CardHeader, SectionCard } from '../SectionCard'

function Stat({ label, value, className }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] leading-4 text-slate-400 uppercase">{label}</span>
      <span className={cn('text-xs leading-4 font-semibold text-slate-800', className)}>{value}</span>
    </div>
  )
}

function LocationRow({ location }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50/40 p-[13px]">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded border text-xs leading-4 font-bold',
            location.primary ? 'border-teal-200 bg-teal-50 text-brand' : 'border-slate-200 bg-slate-100 text-slate-700',
          )}
        >
          {location.code}
        </span>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm leading-5 font-semibold text-slate-900">{location.name}</h3>
            <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-[7px] py-px text-[10px] leading-4 font-semibold text-emerald-800">
              Active
            </span>
          </div>
          <p className="text-[11px] leading-4 text-slate-500">{location.focus}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <Stat label="Appts" value={location.appointments} />
        <Stat label="Collections" value={location.collections} />
        <Stat label="Exceptions" value={location.exceptions.label} className={location.exceptions.className} />
        <button type="button" aria-label={`Open ${location.name}`} className="p-1">
          <img src={icons.rowChevron} alt="" />
        </button>
      </div>
    </li>
  )
}

export default function LocationPerformance({ locations }) {
  return (
    <SectionCard aria-labelledby="location-performance" className="flex flex-col gap-3">
      <CardHeader
        icon={icons.branches}
        title="Location performance"
        subtitle="Real-time multi-branch operational comparison"
        aside={<span className="text-xs leading-4 font-medium text-slate-400">{locations.length} active branches in network</span>}
      />
      <ul className="flex flex-col gap-2">
        {locations.map((location) => (
          <LocationRow key={location.id} location={location} />
        ))}
      </ul>
    </SectionCard>
  )
}
