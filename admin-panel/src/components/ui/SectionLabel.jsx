import { cn } from '../../lib/cn'

export default function SectionLabel({ title, required = false, tag, bordered = true }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', bordered && 'border-b border-slate-200/60 pb-[5px]')}>
      <h2 className="flex items-center gap-1.5 text-xs font-bold tracking-[0.6px] text-slate-800 uppercase">
        {title}
        {required && <span className="text-rose-500">*</span>}
      </h2>
      {tag && (
        <span className="rounded bg-slate-100/70 px-2 py-0.5 text-[11px] font-semibold tracking-[0.55px] whitespace-nowrap text-slate-500 uppercase">
          {tag}
        </span>
      )}
    </div>
  )
}
