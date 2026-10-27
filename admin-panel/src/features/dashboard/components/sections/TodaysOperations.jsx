import { dashboardIcons as icons } from '../../../../assets/icons/dashboard'
import { cn } from '../../../../lib/cn'
import { CardHeader, SectionCard } from '../SectionCard'

const CHIP_TONES = {
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
}

const STATUS_TONES = {
  slate: 'border-transparent bg-slate-200 text-slate-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

function SessionCard({ session }) {
  return (
    <article
      className={cn(
        'flex flex-1 flex-col gap-2 rounded border p-[15px]',
        session.highlighted ? 'border-teal-200 bg-teal-50/20' : 'border-slate-200 bg-slate-50/50',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <img src={session.icon} alt="" />
          <h3 className="text-xs leading-4 font-semibold text-slate-900">{session.title}</h3>
          <span className="text-[11px] leading-[16.5px] text-slate-400">{session.window}</span>
        </div>
        <span
          className={cn(
            'rounded-xl border px-[9px] py-[3px] text-[10px] leading-[15px] font-semibold',
            STATUS_TONES[session.status.tone],
          )}
        >
          {session.status.label}
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 text-xs leading-4 font-medium">
        {session.stats.map((stat, index) => (
          <span key={stat.label} className="flex gap-2">
            {index > 0 && <span className="text-slate-700">·</span>}
            <span className={stat.className}>{stat.label}</span>
          </span>
        ))}
      </p>

      <div className="flex h-1.5 overflow-clip rounded-xl bg-slate-200" role="presentation">
        {session.bar.map((segment) => (
          <span key={segment.className} className={cn('h-full', segment.className)} style={{ width: `${segment.width}%` }} />
        ))}
      </div>
    </article>
  )
}

export default function TodaysOperations({ operations }) {
  return (
    <SectionCard aria-labelledby="todays-operations" className="flex flex-col gap-4">
      <CardHeader
        icon={icons.opsClock}
        title="Today's operations"
        subtitle="Clinic activity timeline & session capacity"
        aside={
          <div className="flex flex-wrap gap-1.5">
            {operations.chips.map((chip) => (
              <span
                key={chip.label}
                className={cn('rounded-sm border px-[9px] py-[3px] text-[11px] leading-[16.5px] font-medium', CHIP_TONES[chip.tone])}
              >
                {chip.label}: <b className="font-bold">{chip.value}</b>
              </span>
            ))}
          </div>
        }
      />
      <div className="flex flex-col gap-4 md:flex-row">
        {operations.sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </SectionCard>
  )
}
