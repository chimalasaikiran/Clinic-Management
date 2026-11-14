import { cn } from '../../lib/cn'

// A titled card. `icon` is a lucide component, `action` sits at the right of the header.
export default function Panel({ title, subtitle, icon: Icon, action, tone = 'default', className, bodyClassName, children }) {
  return (
    <section
      className={cn(
        'rounded-lg border bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)]',
        tone === 'danger' ? 'border-red-200 bg-red-50/40' : 'border-slate-200',
        className,
      )}
    >
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1 basis-56">
            <h2 className={cn('flex items-center gap-2 text-base font-semibold', tone === 'danger' ? 'text-danger' : 'text-slate-900')}>
              {Icon && <Icon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />}
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs leading-4 text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}
