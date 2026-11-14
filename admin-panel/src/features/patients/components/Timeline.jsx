import { cn } from '../../../lib/cn'

// Vertical audit / activity trail. Each event: { time, title, detail?, by? }.
export default function Timeline({ events, className }) {
  if (!events.length) return <p className="text-xs text-on-surface-variant">No events recorded yet.</p>
  return (
    <ol className={cn('flex flex-col gap-4', className)}>
      {events.map((event) => (
        <li key={`${event.time}-${event.title ?? event.text}`} className="relative flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[13px] font-semibold text-on-surface">{event.title ?? event.text}</p>
              <time className="font-mono text-[10px] text-outline">{event.time}</time>
            </div>
            {(event.detail ?? event.by) && <p className="text-xs leading-5 text-on-surface-variant">{event.detail ?? event.by}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
