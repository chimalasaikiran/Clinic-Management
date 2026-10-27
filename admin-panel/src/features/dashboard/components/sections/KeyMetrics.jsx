import { cn } from '../../../../lib/cn'
import { SectionCard } from '../SectionCard'

function MetricValue({ value, unit }) {
  return (
    <p className="font-sans text-xl leading-7 font-medium tracking-[-0.5px] text-slate-900">
      {value}
      {unit && <span className="pl-1 text-xs leading-4 tracking-normal text-slate-500">{unit}</span>}
    </p>
  )
}

function Metric({ metric }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-2 lg:py-0 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] leading-[16.5px] font-semibold tracking-[0.55px] text-slate-500 uppercase">
          {metric.label}
        </span>
        <img src={metric.icon} alt="" />
      </div>
      <MetricValue value={metric.value} unit={metric.unit} />
      <p className="text-[11px] leading-[16.5px] text-slate-500">{metric.detail}</p>

      {metric.bar && (
        <div className="mt-1 flex h-1.5 overflow-clip rounded-xl bg-slate-100" role="presentation">
          {metric.bar.map((segment) => (
            <span key={segment.className} className={cn('h-full', segment.className)} style={{ width: `${segment.width}%` }} />
          ))}
        </div>
      )}
      {metric.status && (
        <p className="flex items-start gap-1 text-[11px] leading-[16.5px] font-medium text-emerald-700">
          <span className="mt-[5px] h-1.5 w-[5px] shrink-0 rounded-xl bg-emerald-500" />
          {metric.status}
        </p>
      )}
      {metric.note && <p className="text-[11px] leading-[16.5px] text-slate-500">{metric.note}</p>}
      {metric.warning && <p className="text-[11px] leading-[16.5px] font-medium text-amber-800">{metric.warning}</p>}
      {metric.queue && (
        <p className="flex items-center justify-between text-[11px] leading-[16.5px]">
          <span className="text-slate-400">{metric.queue.label}</span>
          <span className="font-semibold text-brand">{metric.queue.pending}</span>
        </p>
      )}
    </div>
  )
}

export default function KeyMetrics({ metrics }) {
  return (
    <SectionCard aria-label="Today's key numbers" className="p-[17px]">
      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
        {metrics.map((metric) => (
          <Metric key={metric.id} metric={metric} />
        ))}
      </div>
    </SectionCard>
  )
}
