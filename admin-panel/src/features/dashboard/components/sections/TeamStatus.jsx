import { dashboardIcons as icons } from '../../../../assets/icons/dashboard'
import { cn } from '../../../../lib/cn'
import { CardHeader, CardLink, SectionCard } from '../SectionCard'

export default function TeamStatus({ team }) {
  return (
    <SectionCard aria-labelledby="team-status" className="flex flex-col justify-between gap-4">
      <div className="flex flex-col gap-3.5">
        <CardHeader icon={icons.team} title="Team status" aside={<CardLink>View staff</CardLink>} />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs leading-4 font-semibold text-slate-900">{team.total} total staff</span>
            <span className="flex items-center gap-2 text-[11px] leading-4">
              {team.presence.map((group, index) => (
                <span key={group.label} className="flex gap-2">
                  {index > 0 && <span className="text-on-surface">·</span>}
                  <span className={cn('font-medium', group.labelClass)}>{group.label}</span>
                </span>
              ))}
            </span>
          </div>

          <div className="flex h-2 overflow-clip rounded-xl bg-slate-100" role="presentation">
            {team.presence.map((group) => (
              <span
                key={group.label}
                className={cn('h-full', group.barClass)}
                style={{ width: `${(group.count / team.total) * 100}%` }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50/80 p-[11px]">
            <span className="flex items-center gap-2 text-xs leading-4 font-medium text-amber-900">
              <img src={icons.warning} alt="" />
              {team.alert}
            </span>
            <button type="button" className="text-[11px] leading-4 font-semibold text-amber-900 underline">
              Resolve
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {team.shifts.map((shift) => (
              <div
                key={shift.label}
                className="flex flex-col items-center gap-[2.5px] rounded-sm border border-slate-200 bg-slate-50 px-[9px] pt-[9px] pb-[10.5px]"
              >
                <span className="text-[10px] leading-[15px] text-slate-500 uppercase">{shift.label}</span>
                <span className="text-sm leading-5 font-semibold text-slate-900">{shift.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-[9px] text-[11px] leading-[16.5px]">
        <span className="text-slate-500">{team.nextSync}</span>
        <span className="font-medium text-emerald-700">{team.syncStatus}</span>
      </div>
    </SectionCard>
  )
}
