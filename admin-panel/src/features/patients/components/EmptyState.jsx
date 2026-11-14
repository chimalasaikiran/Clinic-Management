// Shown when a patient has no records of a kind yet (new registrations start empty).
export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 size-6 text-outline" aria-hidden="true" />}
      <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
      {children && <p className="mt-1 max-w-md text-xs leading-5 text-on-surface-variant">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
