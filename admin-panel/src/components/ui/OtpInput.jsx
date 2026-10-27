import { useRef } from 'react'

import { cn } from '../../lib/cn'

export default function OtpInput({ value, onChange, invalid = false }) {
  const refs = useRef([])
  const length = value.length

  const focusAt = (index) => refs.current[index]?.focus()

  const setDigit = (index, digit) => {
    const next = [...value]
    next[index] = digit
    onChange(next)
  }

  const handleChange = (index, event) => {
    const digit = event.target.value.replace(/\D/g, '').slice(-1)
    setDigit(index, digit)
    if (digit && index < length - 1) focusAt(index + 1)
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      event.preventDefault()
      setDigit(index - 1, '')
      focusAt(index - 1)
    } else if (event.key === 'ArrowLeft' && index > 0) {
      focusAt(index - 1)
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      focusAt(index + 1)
    }
  }

  const handlePaste = (index, event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return
    event.preventDefault()
    const next = [...value]
    for (let offset = 0; offset < pasted.length && index + offset < length; offset += 1) {
      next[index + offset] = pasted[offset]
    }
    onChange(next)
    focusAt(Math.min(index + pasted.length, length - 1))
  }

  return (
    <div className="flex justify-center gap-2.5" role="group" aria-label="Verification code">
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element
          }}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          placeholder="·"
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          aria-invalid={invalid ? true : undefined}
          className={cn(
            'h-[52px] min-w-0 flex-1 rounded-xl border bg-white text-center text-lg font-semibold text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600',
            invalid ? 'border-rose-400' : 'border-slate-200',
          )}
        />
      ))}
    </div>
  )
}
