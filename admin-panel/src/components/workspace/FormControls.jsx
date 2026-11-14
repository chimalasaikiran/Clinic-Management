import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import Field from '../ui/Field'
import { controlClass, errorIdFor, invalidControlClass } from '../ui/fieldStyles'

// Compact (40px) inputs for dense workspace forms; the onboarding forms use the taller ui/ fields.
export function TextInput({ id, label, hint, required, error, prefix, className, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field label={label} hint={hint} htmlFor={inputId} required={required} error={error}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-outline">{prefix}</span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorIdFor(inputId) : undefined}
          className={cn(controlClass, 'h-10 px-3 text-[13px]', prefix && 'pl-12', error && invalidControlClass, className)}
          {...props}
        />
      </div>
    </Field>
  )
}

export function SelectInput({ id, label, hint, required, error, placeholder, options, className, ...props }) {
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
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-outline" aria-hidden="true" />
      </div>
    </Field>
  )
}
