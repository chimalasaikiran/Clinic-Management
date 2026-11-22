import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import { cn } from '../../../lib/cn'

export function CheckOption({ checked, onChange, children, className }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700', className)}>
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded accent-ink" />
      {children}
    </label>
  )
}

const NOTICE_TONES = {
  neutral: 'border-slate-200/80 bg-slate-50 text-slate-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  success: 'border-teal-200 bg-teal-50/70 text-teal-800',
}

export function Notice({ tone = 'neutral', icon = icons.infoCircle, title, children }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3.5', NOTICE_TONES[tone])}>
      <img src={icon} alt="" className="mt-0.5 shrink-0" />
      <div className="text-xs leading-[18px]">
        <p className="text-[13px] font-semibold">{title}</p>
        {children}
      </div>
    </div>
  )
}

export function FieldError({ children }) {
  return children ? (
    <p role="alert" className="text-xs leading-4 text-rose-600">
      {children}
    </p>
  ) : null
}

// Primary action, then a back link on the left and a secondary link on the right.
export function StepActions({ submitLabel, back, secondary, pending = false, note = 'Optional setup · You can return to this later.' }) {
  return (
    <div className="flex flex-col gap-3.5 border-t border-slate-200/70 pt-5">
      <Button type="submit" fullWidth disabled={pending} trailing={<img src={icons.arrowRight} alt="" />}>
        {submitLabel}
      </Button>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        {back}
        {secondary}
      </div>
      <p className="text-center text-[11px] text-slate-400">{note}</p>
    </div>
  )
}
