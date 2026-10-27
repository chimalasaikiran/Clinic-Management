import { cn } from '../../lib/cn'
import { errorIdFor } from './fieldStyles'

export default function Field({ label, hint, htmlFor, required = false, error, className, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || hint) && (
        <div className="flex items-center justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-semibold text-slate-800">
              {label}
              {required && <span className="text-rose-500"> *</span>}
            </label>
          )}
          {hint && <span className="text-[11px] font-medium text-slate-400">{hint}</span>}
        </div>
      )}
      {children}
      {error && (
        <p id={errorIdFor(htmlFor)} role="alert" className="text-xs leading-4 text-rose-600">
          {error}
        </p>
      )}
    </div>
  )
}
