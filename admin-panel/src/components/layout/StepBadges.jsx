const pad = (value) => String(value).padStart(2, '0')

export function StepCounterBadge({ current, total, label }) {
  return (
    <span className="flex items-center rounded-full bg-slate-900 px-3 py-1 shadow-sm">
      <span className="font-mono text-[11px] leading-5 font-semibold tracking-[0.55px] text-emerald-400">
        {pad(current)} / {pad(total)}
      </span>
      <span className="hidden items-center sm:flex">
        <span className="pl-2 text-[10px] leading-5 text-slate-500">·</span>
        <span className="pl-2 text-[11px] leading-5 font-semibold tracking-[0.55px] whitespace-nowrap text-slate-200 uppercase">
          {label}
        </span>
      </span>
    </span>
  )
}

export function StepDotBadge({ current, total, label }) {
  return (
    <span className="flex h-7 items-center rounded-full border border-slate-800 bg-slate-950 px-[15px] shadow-sm">
      <span className="size-1.5 shrink-0 rounded-full bg-teal-400" />
      <span className="pl-2 text-xs font-bold tracking-[0.6px] whitespace-nowrap text-white uppercase">
        {pad(current)} / {pad(total)}
        <span className="hidden sm:inline"> · {label}</span>
      </span>
    </span>
  )
}
