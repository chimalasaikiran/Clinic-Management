import Avatar from '../../../components/workspace/Avatar'
import StatusPill from '../../../components/workspace/StatusPill'

// Identity strip shown at the top of a person's sub-pages (schedule, leave, attendance, account).
export default function PersonBanner({ person, badge, subtitle, facts = [] }) {
  return (
    <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar initials={person.initials} tone="teal" size="lg" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-on-surface">
            {person.shortName ?? person.name}
            <span className="rounded border border-slate-200 bg-surface-low px-1.5 py-0.5 font-mono text-[11px] font-normal text-on-surface-variant">{person.staffCode}</span>
            {badge && <StatusPill tone="success">{badge}</StatusPill>}
          </p>
          {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-slate-100 pt-4">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt>
              <dd className="text-[13px] font-medium text-on-surface">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
