import { icons } from '../../assets/icons'
import { cn } from '../../lib/cn'

function StepMetaBar({ label }) {
  return (
    <div className="mb-12 flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50 px-[13px] py-[5px] text-[11px] leading-4 font-semibold tracking-[0.55px] text-slate-800 uppercase">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        {label}
      </span>
      <span className="hidden font-mono text-[11px] tracking-[1.1px] text-slate-400 uppercase sm:block">
        Production v4.2
      </span>
    </div>
  )
}

function AssuranceBar({ detailed }) {
  return (
    <div className="mt-10 border-t border-slate-100 pt-8">
      {detailed && (
        <div className="flex items-center justify-between gap-4 text-xs leading-4 text-slate-400">
          <span className="flex items-center gap-1.5">
            <img src={icons.clockSmall} alt="" />
            Approx. 2 minutes · Saves automatically as you progress
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <img src={icons.lock} alt="" />
            End-to-end encrypted
          </span>
        </div>
      )}
    </div>
  )
}

export default function FormPanel({ stepLabel, align = 'start', assurance = 'none', className, children }) {
  return (
    <section
      className={cn(
        'flex w-full flex-1 flex-col bg-white px-5 py-8 sm:px-12 sm:py-12 lg:w-[47%] lg:flex-none lg:shrink-0 lg:px-16 lg:py-14',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[473px] flex-1 flex-col">
        {stepLabel && <StepMetaBar label={stepLabel} />}
        <div className={cn('flex flex-1 flex-col', align === 'center' && 'justify-center')}>{children}</div>
        {assurance !== 'none' && <AssuranceBar detailed={assurance === 'detailed'} />}
      </div>
    </section>
  )
}
