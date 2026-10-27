import { useId } from 'react'
import { cn } from '../../lib/cn'
import Field from './Field'
import { controlClass, errorIdFor, invalidControlClass } from './fieldStyles'

export default function TextField({
  id,
  label,
  hint,
  required,
  error,
  startIcon,
  endIcon,
  muted = false,
  className,
  ...props
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <Field label={label} hint={hint} htmlFor={inputId} required={required} error={error}>
      <div className="relative">
        {startIcon && (
          <img
            src={startIcon}
            alt=""
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorIdFor(inputId) : undefined}
          className={cn(
            controlClass,
            'h-12 px-4',
            startIcon && 'pl-10',
            endIcon && 'pr-10',
            muted && 'bg-slate-50/40',
            error && invalidControlClass,
            className,
          )}
          {...props}
        />
        {endIcon && (
          <img src={endIcon} alt="" className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2" />
        )}
      </div>
    </Field>
  )
}
