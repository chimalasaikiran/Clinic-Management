import { cn } from '../../lib/cn'

export default function ChoiceChip({ selected = false, children, ...props }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-[7px] text-[10px] leading-4 font-medium transition',
        selected
          ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
      )}
      {...props}
    >
      <span className={cn('size-1.5 rounded-full', selected ? 'bg-emerald-600' : 'bg-slate-300')} />
      {children}
    </button>
  )
}
