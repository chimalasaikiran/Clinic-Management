import { cn } from '../../lib/cn'

// Eyebrow + title + description on the left, page actions on the right.
export default function PageIntro({ eyebrow, title, description, actions, note, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4 pb-6', className)}>
      <div className="min-w-0 max-w-2xl flex-1 basis-96">
        {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">{eyebrow}</div>}
        <h1 className="text-[28px] leading-9 font-bold tracking-tight text-on-surface">{title}</h1>
        {description && <p className="mt-1 text-sm leading-5 text-on-surface-variant">{description}</p>}
      </div>
      {(actions || note) && (
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
          {note && <p className="text-[11px] text-outline">{note}</p>}
        </div>
      )}
    </div>
  )
}
