import { useId } from 'react'
import { icons } from '../../assets/icons'
import { cn } from '../../lib/cn'
import Field from './Field'
import { errorIdFor, invalidControlClass } from './fieldStyles'

export default function PhoneField({
  id,
  label,
  hint,
  required,
  error,
  countryCode = '+91',
  flag = '🇮🇳',
  ...props
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field label={label} hint={hint} htmlFor={inputId} required={required} error={error}>
      <div
        className={cn(
          'flex h-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10',
          error && invalidControlClass,
        )}
      >
        <span className="flex shrink-0 items-center gap-1.5 border-r border-slate-200 bg-slate-50 pr-3 pl-3.5 text-[13px] font-semibold text-slate-800">
          <span aria-hidden="true">{flag}</span>
          {countryCode}
          <img src={icons.chevronSmall} alt="" />
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorIdFor(inputId) : undefined}
          className="min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          {...props}
        />
      </div>
    </Field>
  )
}
