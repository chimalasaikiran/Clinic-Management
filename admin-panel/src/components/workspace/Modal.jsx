import { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

// Centered dialog for short, decisive confirmations. Escape and the backdrop dismiss it.
export default function Modal({ open, onClose, eyebrow, title, description, footer, width = 'max-w-xl', children }) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 bg-slate-900/50" />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn('relative flex max-h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl', width)}>
        <header className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            {eyebrow && <p className="rounded border border-slate-200 bg-surface-low px-2 py-1 text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">{eyebrow}</p>}
            <button type="button" aria-label="Close" onClick={onClose} className="ml-auto text-outline hover:text-on-surface"><X className="size-4" aria-hidden="true" /></button>
          </div>
          <h2 id={titleId} className="mt-3 text-2xl font-semibold text-on-surface">{title}</h2>
          {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="border-t border-slate-200 px-6 py-4">{footer}</footer>}
      </div>
    </div>
  )
}
