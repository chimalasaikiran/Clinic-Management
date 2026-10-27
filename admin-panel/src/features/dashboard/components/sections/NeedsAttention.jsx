import { dashboardIcons as icons } from '../../../../assets/icons/dashboard'
import { cn } from '../../../../lib/cn'
import { CardLink, SectionCard } from '../SectionCard'

const TONES = {
  amber: { box: 'border-amber-200 bg-amber-50', badge: 'border-amber-200 bg-amber-50 text-amber-800' },
  indigo: { box: 'border-indigo-200 bg-indigo-50', badge: 'border-indigo-200 bg-indigo-50 text-indigo-800' },
  rose: { box: 'border-rose-200 bg-rose-50', badge: 'border-rose-200 bg-rose-50 text-rose-800' },
  orange: { box: 'border-orange-200 bg-orange-50', badge: 'border-orange-200 bg-orange-50 text-orange-800' },
}

function AttentionRow({ item }) {
  const tone = TONES[item.tone]

  return (
    <li className="-mx-2 flex flex-wrap items-center justify-between gap-3 rounded px-2 py-2.5 not-first:border-t not-first:border-slate-100 first:pt-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded border', tone.box)}>
          <img src={item.icon} alt="" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs leading-4 font-semibold text-slate-900">{item.title}</h3>
            <span className={cn('rounded-sm border px-[7px] py-px text-[10px] leading-[15px] font-semibold', tone.badge)}>
              {item.badge}
            </span>
          </div>
          <p className="text-[11px] leading-[16.5px] text-slate-500">{item.description}</p>
        </div>
      </div>
      <button
        type="button"
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-sm px-3 py-1 text-xs leading-4 font-medium transition-opacity hover:opacity-90',
          item.primary ? 'bg-black text-white' : 'border border-slate-300 bg-white px-[13px] py-[5px] text-slate-800',
        )}
      >
        {item.action}
        <img src={item.primary ? icons.arrowWhite : icons.arrowDark} alt="" />
      </button>
    </li>
  )
}

export default function NeedsAttention({ items }) {
  return (
    <SectionCard aria-labelledby="needs-attention" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-xl bg-rose-500 shadow-[0_0_0_4px_#ffe4e6]" />
            <h2 id="needs-attention" className="font-sans text-base leading-6 font-semibold tracking-[-0.4px] text-slate-900">
              Needs attention
            </h2>
          </div>
          <span className="rounded-xl border border-rose-200 bg-rose-50 px-[9px] py-[3px] text-xs leading-4 font-semibold text-rose-800">
            {items.length} items requiring action
          </span>
        </div>
        <CardLink>Operational Exceptions Log</CardLink>
      </div>
      <p className="text-xs leading-4 text-slate-500">Items that may need your attention today.</p>
      <ul className="border-t border-slate-100 pt-1.5">
        {items.map((item) => (
          <AttentionRow key={item.id} item={item} />
        ))}
      </ul>
    </SectionCard>
  )
}
