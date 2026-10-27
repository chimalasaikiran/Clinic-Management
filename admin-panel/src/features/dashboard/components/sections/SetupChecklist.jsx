import { useState } from 'react'
import { dashboardIcons as icons } from '../../../../assets/icons/dashboard'
import { SectionCard } from '../SectionCard'

export default function SetupChecklist({ checklist }) {
  const [hidden, setHidden] = useState(false)
  const percent = Math.round((checklist.completed / checklist.total) * 100)

  if (hidden) return null

  return (
    <SectionCard aria-labelledby="complete-setup" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-[11px]">
        <div className="flex flex-col gap-0.5">
          <h2 id="complete-setup" className="font-sans text-base leading-6 font-semibold tracking-[-0.4px] text-slate-900">
            Complete your setup
          </h2>
          <p className="max-w-[16rem] text-xs leading-4 text-slate-500">
            Finish a few configuration steps before your clinic is fully ready.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="shrink-0 text-xs leading-4 font-medium text-slate-400 transition-colors hover:text-slate-600"
        >
          Hide setup guide
        </button>
      </div>

      <div className="flex flex-col gap-1.5 rounded border border-slate-200 bg-slate-50 px-[13px] pt-[15px] pb-[13px]">
        <div className="flex items-center justify-between text-xs leading-4">
          <span className="font-semibold text-slate-800">
            {checklist.completed} of {checklist.total} completed
          </span>
          <span className="font-bold text-brand">{percent}%</span>
        </div>
        <div className="h-1.5 overflow-clip rounded-xl bg-slate-200" role="presentation">
          <span className="block h-full rounded-xl bg-brand" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ul className="flex flex-col">
        <li className="flex items-center justify-between gap-3 rounded border border-teal-200/60 bg-teal-50/50 px-[9px] pt-[11px] pb-[15px]">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-xl bg-brand">
              <img src={icons.setupCheck} alt="" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs leading-4 font-semibold text-slate-900">{checklist.next.title}</span>
              <span className="text-[11px] leading-4 text-teal-800">{checklist.next.hint}</span>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-sm bg-brand px-2 py-0.5 text-[11px] leading-4 font-semibold text-white transition-opacity hover:opacity-90"
          >
            {checklist.next.action}
          </button>
        </li>
        {checklist.remaining.map((item) => (
          <li key={item.step} className="flex items-center justify-between border-t border-slate-100 pt-2 pb-[7px] first:border-t-0">
            <span className="flex items-center gap-2 text-xs leading-4 text-slate-600">
              <span className="flex h-[18px] w-4 items-center justify-center rounded-xl border border-slate-300 text-[10px] leading-4 font-medium text-slate-400">
                {item.step}
              </span>
              {item.label}
            </span>
            <span className="text-[11px] leading-4 text-slate-400">{item.hint}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-[11px] text-[11px] leading-[16.5px]">
        <span className="text-slate-500">Ongoing workspace configuration · Non-blocking</span>
        <button type="button" className="shrink-0 font-semibold text-brand">
          Concierge 1:1
        </button>
      </div>
    </SectionCard>
  )
}
