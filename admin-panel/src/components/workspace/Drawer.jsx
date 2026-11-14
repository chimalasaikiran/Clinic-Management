import { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

// Right-hand slide-over. Render it conditionally or pass `open`; Escape and the backdrop close it.
export default function Drawer({ open, onClose, eyebrow, title, description, footer, width = 'max-w-lg', children }) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('relative flex h-full w-full flex-col bg-white shadow-2xl', width)}
      >
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            {eyebrow ? (
              <p className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">
                {eyebrow}
              </p>
            ) : (
              <span />
            )}
            <button type="button" aria-label="Close" onClick={onClose} className="text-outline hover:text-on-surface">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <h2 id={titleId} className="mt-3 text-lg font-semibold text-on-surface">
            {title}
          </h2>
          {description && <p className="mt-1 text-xs leading-5 text-on-surface-variant">{description}</p>}
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && <footer className="border-t border-slate-200 px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  )
}
