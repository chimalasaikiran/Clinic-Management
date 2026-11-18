import { cn } from '../../../lib/cn'

const tones = {
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
}

// Form-level message: server errors, confirmations and notices carried over from another page.
export default function FormMessage({ tone = 'error', children, className }) {
  if (!children) return null
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-[13px] leading-5', tones[tone], className)}>
      {children}
    </p>
  )
}
