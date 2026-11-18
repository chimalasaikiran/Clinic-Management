import AppTopBar from '../../../components/layout/AppTopBar'
import FormPanel from '../../../components/layout/FormPanel'
import ShowcasePanel from '../../../components/layout/ShowcasePanel'
import { StepDotBadge } from '../../../components/layout/StepBadges'
import { cn } from '../../../lib/cn'

const TOTAL_STEPS = 3
const pad = (value) => String(value).padStart(2, '0')

// Split onboarding shell for the three insurance setup steps: form on the right, showcase on the left.
export default function InsuranceLayout({ step, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppTopBar badge={<StepDotBadge current={step} total={TOTAL_STEPS} label="Insurance setup" />} />
      <main className="flex flex-1 flex-col lg:flex-row">
        <FormPanel className="border-slate-200/80 lg:order-2 lg:border-l">
          <div className="mb-10">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50 px-[13px] py-[5px] text-[11px] leading-4 font-semibold tracking-[0.55px] text-slate-800 uppercase">
                <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                Insurance · {pad(step)} of {pad(TOTAL_STEPS)}
              </span>
              <span className="rounded bg-slate-100/70 px-2 py-0.5 text-[11px] font-semibold tracking-[0.55px] text-slate-500 uppercase">Optional setup</span>
            </div>
            <div className="grid grid-cols-3 gap-2" role="progressbar" aria-label="Insurance setup progress" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step}>
              {Array.from({ length: TOTAL_STEPS }, (_, index) => (
                <span key={index} className={cn('h-[3px] rounded-full', index < step ? 'bg-teal-600' : 'bg-slate-200')} />
              ))}
            </div>
          </div>
          {children}
        </FormPanel>
        <ShowcasePanel className="lg:order-1" />
      </main>
    </div>
  )
}
