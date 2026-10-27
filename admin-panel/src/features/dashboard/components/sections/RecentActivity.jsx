import { cn } from '../../../../lib/cn'
import { CardLink, SectionCard } from '../SectionCard'

function Body({ parts }) {
  return parts.map((part, index) => {
    if (typeof part === 'string') return <span key={index}>{part}</span>
    if (part.muted) return <span key={index} className="text-slate-700">{part.muted}</span>
    return (
      <span key={index} className="font-medium text-slate-800">
        {part.strong}
      </span>
    )
  })
}

export default function RecentActivity({ events }) {
  return (
    <SectionCard aria-labelledby="recent-activity" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-[15px]">
        <div className="flex items-center gap-2">
          <h2 id="recent-activity" className="font-sans text-base leading-6 font-semibold tracking-[-0.4px] text-slate-900">
            Recent activity
          </h2>
          <span className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-[9px] py-[3px] text-[11px] leading-[16.5px] font-semibold text-emerald-700">
            <span className="size-1.5 rounded-xl bg-emerald-500" />
            Live Stream
          </span>
        </div>
        <CardLink>View audit trail</CardLink>
      </div>

      <ol className="relative flex flex-col gap-5 pt-4 pl-6">
        <span className="absolute top-[20.5px] bottom-3 left-[7px] w-px bg-slate-200" aria-hidden="true" />
        {events.map((event) => (
          <li key={event.id} className="relative flex flex-col gap-0.5">
            <span
              className={cn('absolute top-0.5 -left-[26px] size-[18px] rounded-xl border-2 border-white', event.dot)}
              aria-hidden="true"
            />
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs leading-4 font-semibold text-slate-900">{event.title}</h3>
              <span className="shrink-0 text-[11px] leading-[16.5px] text-slate-400">{event.time}</span>
            </div>
            <p className="text-xs leading-4 text-slate-600">
              <Body parts={event.body} />
            </p>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}
