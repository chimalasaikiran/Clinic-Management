import { SectionCard } from '../SectionCard'

export default function QuickActions({ actions }) {
  return (
    <SectionCard aria-labelledby="quick-actions" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="quick-actions" className="font-sans text-base leading-6 font-semibold tracking-[-0.4px] text-slate-900">
          Quick actions
        </h2>
        <span className="text-[11px] leading-[16.5px] text-slate-400">Common shortcuts</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="flex flex-col items-center gap-1 rounded border border-slate-200 px-1 py-[11px] transition-colors hover:bg-slate-50"
          >
            <span className="flex size-7 items-center justify-center rounded-xl bg-slate-100">
              <img src={action.icon} alt="" />
            </span>
            <span className="max-w-[4.5rem] text-center text-[11px] leading-[13.75px] font-medium text-slate-800">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  )
}
