import { icons } from '../../assets/icons'
import { cn } from '../../lib/cn'

function Indicator({ selected }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
        selected ? 'border-ink bg-ink' : 'border-slate-300 bg-white',
      )}
    >
      {selected && <img src={icons.check} alt="" />}
    </span>
  )
}

export default function SelectableCard({
  title,
  description,
  tag,
  icon,
  selected = false,
  indicator = false,
  compact = false,
  role = 'radio',
  className,
  ...props
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      className={cn(
        'flex w-full items-start justify-between gap-2 rounded-xl border text-left shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition',
        compact ? 'p-3' : 'p-3.5',
        selected
          ? 'border-ink bg-slate-50/60 shadow-[0_0_0_1px_var(--color-ink),0_4px_6px_-1px_rgba(0,0,0,0.1)]'
          : 'border-slate-200 bg-white hover:border-slate-300',
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {icon && (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <img src={icon} alt="" />
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className={cn('text-xs font-bold', selected ? 'text-slate-950' : 'text-slate-900')}>{title}</span>
            {tag && <span className="text-[10px] font-medium text-slate-500">{tag}</span>}
          </span>
          {description && (
            <span
              className={cn(
                'leading-[15px]',
                compact ? 'text-[10px]' : 'text-[11px]',
                selected ? 'text-slate-700' : 'text-slate-500',
              )}
            >
              {description}
            </span>
          )}
        </span>
      </span>
      {indicator && <Indicator selected={selected} />}
    </button>
  )
}
