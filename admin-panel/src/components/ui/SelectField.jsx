import { useId } from 'react'
import { icons } from '../../assets/icons'
import { cn } from '../../lib/cn'
import Field from './Field'
import { controlClass, errorIdFor, invalidControlClass } from './fieldStyles'

export default function SelectField({ id, label, hint, required, error, placeholder, options, className, ...props }) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <Field label={label} hint={hint} htmlFor={selectId} required={required} error={error}>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorIdFor(selectId) : undefined}
          className={cn(controlClass, 'h-12 appearance-none py-0 pr-10 pl-4', error && invalidControlClass, className)}
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
        <img
          src={icons.selectChevron}
          alt=""
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
        />
      </div>
    </Field>
  )
}
