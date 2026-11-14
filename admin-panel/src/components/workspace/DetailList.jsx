import { cn } from '../../lib/cn'

// Read-only label/value pairs laid out in a responsive grid.
export default function DetailList({ items, columns = 2, className }) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-5', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map(({ label, value, full }) => (
        <div key={label} className={cn('min-w-0', full && 'sm:col-span-2')}>
          <dt className="text-[11px] leading-4 text-outline">{label}</dt>
          <dd className="mt-0.5 text-[13px] leading-5 font-medium text-on-surface">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
