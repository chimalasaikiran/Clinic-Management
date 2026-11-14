import { cn } from '../../lib/cn'

// Scrollable table shell: styled header row, caller supplies the <tr> rows as children.
export function Table({ headings, minWidth = 760, children, empty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left" style={{ minWidth }}>
        <thead className="bg-surface-lowest text-[11px] font-semibold tracking-wide text-on-surface-variant uppercase">
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className="px-4 py-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">{empty}</p>}
    </div>
  )
}

export function Row({ muted, children }) {
  return <tr className={cn('border-b border-slate-100 align-top last:border-0 hover:bg-surface-lowest', muted && 'opacity-60')}>{children}</tr>
}

export function Cell({ className, children }) {
  return <td className={cn('px-4 py-3 text-[13px] text-on-surface', className)}>{children}</td>
}

export function TableFooter({ summary, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-on-surface-variant">
      <p>{summary}</p>
      {children}
    </div>
  )
}

export function StatTiles({ items, className }) {
  return (
    <dl className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-slate-200 bg-white p-4">
          <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{item.label}</dt>
          <dd className="mt-1.5 text-2xl leading-8 font-bold text-on-surface">{item.value}</dd>
          {item.hint && <p className="mt-0.5 text-xs text-on-surface-variant">{item.hint}</p>}
        </div>
      ))}
    </dl>
  )
}
