import { Check, ChevronRight } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import Breadcrumb from '../../../components/workspace/Breadcrumb'
import PageIntro from '../../../components/workspace/PageIntro'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { Banner } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { usePayroll } from '../context/usePayroll'

const STEPS = [
  { label: 'Payroll period', to: ROUTES.payrollRun },
  { label: 'Review staff', to: ROUTES.payrollRunStaff },
  { label: 'Review calculations', to: ROUTES.payrollRunCalculations },
  { label: 'Adjustments', to: ROUTES.payrollRunAdjustments },
  { label: 'Employee advances', to: ROUTES.payrollRunAdvances },
  { label: 'Final review', to: ROUTES.payrollRunReview },
  { label: 'Process payroll', to: ROUTES.payrollRunProcess },
]

const BATCH_TONES = { Draft: 'warning', Approved: 'info', Processed: 'success' }

// Header and step tracker shared by every step of a payroll run; steps render in the outlet.
export default function RunPayrollLayout() {
  const { pathname } = useLocation()
  const { cycle, batch } = usePayroll()
  const current = STEPS.findLastIndex((step) => (step.to === ROUTES.payrollRun ? pathname === step.to : pathname.startsWith(step.to)))

  return (
    <WorkspacePage>
      <Breadcrumb items={[{ label: 'Payroll', to: ROUTES.payroll }, { label: 'Run payroll' }]} />
      <PageIntro
        eyebrow={
          <>
            <StatusPill tone="brand">Batch ID: {cycle.batchId}</StatusPill>
            <StatusPill tone={BATCH_TONES[batch.status]}>{batch.status}</StatusPill>
          </>
        }
        title="Run payroll"
        description={`Set up the ${cycle.label} payroll period and verify the data required for this payroll run.`}
        note="Regulatory window · Monthly regular cycle (India)"
        className="border-b border-slate-200"
      />

      <nav aria-label="Payroll run steps" className="my-5 rounded-lg border border-slate-200 bg-white p-3">
        <ol className="flex flex-wrap items-center gap-1">
          {STEPS.map((step, index) => (
            <li key={step.to} className="flex items-center gap-1">
              <Link
                to={step.to}
                aria-current={index === current ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                  index === current ? 'border-teal-200 bg-teal-50 font-semibold text-brand' : 'border-transparent hover:bg-surface-low',
                  index < current ? 'text-brand' : index > current && 'text-on-surface-variant',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border text-[10px] font-bold',
                    index === current ? 'border-brand bg-brand text-white' : index < current ? 'border-brand text-brand' : 'border-slate-300',
                  )}
                >
                  {index < current ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                </span>
                {step.label}
              </Link>
              {index < STEPS.length - 1 && <ChevronRight className="size-3.5 text-outline" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </nav>

      {batch.status === 'Processed' && (
        <Banner tone="brand" title="This payroll run has been processed" className="mb-5">
          Recorded on {batch.processedOn}. The run is read-only; corrections go into the next cycle as adjustments.
        </Banner>
      )}

      <Outlet />
    </WorkspacePage>
  )
}
