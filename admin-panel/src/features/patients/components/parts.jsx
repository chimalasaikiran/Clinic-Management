import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../../lib/cn'
import Field from '../../../components/ui/Field'
import { controlClass, errorIdFor, invalidControlClass } from '../../../components/ui/fieldStyles'
import Avatar from '../../../components/workspace/Avatar'
import StatusPill from '../../../components/workspace/StatusPill'

// Numbered section used by the multi-step flow pages (book, reschedule, check-in ...).
export function FlowSection({ number, title, aside, children, className }) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2.5 text-base font-semibold text-on-surface">
          {number && <span className="flex size-6 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">{number}</span>}
          {title}
        </h2>
        {aside && <span className="text-[11px] text-outline">{aside}</span>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

// Sticky right-hand summary / action column of the flow pages.
export function SideCard({ title, tag, children, className }) {
  return (
    <aside className={cn('rounded-lg border border-slate-200 bg-white p-5', className)}>
      {(title || tag) && (
        <header className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-on-surface">{title}</h2>
          {tag}
        </header>
      )}
      {children}
    </aside>
  )
}

export function KeyValueRows({ rows, className }) {
  return (
    <dl className={cn('flex flex-col gap-2.5 text-xs', className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4">
          <dt className="shrink-0 text-outline">{label}</dt>
          <dd className="text-right font-medium text-on-surface">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ChecklistItem({ children, ok = true }) {
  return (
    <li className="flex items-start gap-2 text-xs leading-5 text-on-surface-variant">
      <span className={cn('mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white', ok ? 'bg-emerald-600' : 'bg-amber-500')} aria-hidden="true">
        {ok ? '✓' : '!'}
      </span>
      <span>{children}</span>
    </li>
  )
}

// Patient identity strip at the top of flow pages and inside drawers.
export function PatientStrip({ patient, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Avatar initials={patient.initials} tone="slate" />
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface">
            {patient.name}
            <span className="rounded bg-surface-low px-1.5 py-0.5 font-mono text-[10px] font-normal text-on-surface-variant">{patient.mrn}</span>
            <StatusPill tone="success" dot>Verified {patient.status}</StatusPill>
          </p>
          <p className="text-xs text-on-surface-variant">
            {patient.age} yrs · {patient.gender} · Blood: {patient.bloodGroup} · {patient.mobile}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}

export const FIELD_LABEL = 'text-[13px] font-semibold text-slate-800'

export function TextArea({ id, label, error, hint, required, className, ...props }) {
  const generatedId = useId()
  const areaId = id ?? generatedId
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={areaId} className={FIELD_LABEL}>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      <textarea
        id={areaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorIdFor(areaId) : undefined}
        className={cn('rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15', error ? 'border-rose-400' : 'border-slate-200', className)}
        {...props}
      />
      {error && (
        <span id={errorIdFor(areaId)} role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      )}
      {hint && !error && <span className="text-[11px] text-outline">{hint}</span>}
    </div>
  )
}

export function Check({ label, children, ...props }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-on-surface">
      <input type="checkbox" className="mt-1 accent-[#006a61]" {...props} />
      <span>{label ?? children}</span>
    </label>
  )
}

export function FieldError({ children }) {
  return children ? (
    <p role="alert" className="text-xs text-rose-600">
      {children}
    </p>
  ) : null
}

// Select whose options carry a value and a label ({ value, label }); the shared SelectInput only takes plain strings.
export function OptionSelect({ id, label, hint, required, error, placeholder, options, className, ...props }) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  return (
    <Field label={label} hint={hint} htmlFor={selectId} required={required} error={error}>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorIdFor(selectId) : undefined}
          className={cn(controlClass, 'h-10 appearance-none py-0 pr-9 pl-3 text-[13px]', error && invalidControlClass, className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-outline" aria-hidden="true" />
      </div>
    </Field>
  )
}
