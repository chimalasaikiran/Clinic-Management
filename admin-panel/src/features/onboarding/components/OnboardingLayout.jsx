import AppTopBar from '../../../components/layout/AppTopBar'
import FormPanel from '../../../components/layout/FormPanel'
import ShowcasePanel from '../../../components/layout/ShowcasePanel'
import { StepCounterBadge, StepDotBadge } from '../../../components/layout/StepBadges'
import { cn } from '../../../lib/cn'
import { TOTAL_ONBOARDING_STEPS } from '../data/onboardingSteps'

const pad = (value) => String(value).padStart(2, '0')

export default function OnboardingLayout({ step, formSide = 'left', align, assurance, children }) {
  const formOnRight = formSide === 'right'
  const Badge = step?.badge === 'counter' ? StepCounterBadge : StepDotBadge

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppTopBar
        badge={
          step && <Badge current={step.current} total={TOTAL_ONBOARDING_STEPS} label={step.headerLabel} />
        }
      />
      <main className="flex flex-1 flex-col lg:flex-row">
        <FormPanel
          stepLabel={step && `Step ${pad(step.current)} of ${pad(TOTAL_ONBOARDING_STEPS)} · ${step.metaLabel}`}
          align={align}
          assurance={assurance}
          className={cn(
            'border-slate-200/80',
            formOnRight ? 'lg:order-2 lg:border-l' : 'lg:order-1 lg:border-r',
          )}
        >
          {children}
        </FormPanel>
        <ShowcasePanel className={formOnRight ? 'lg:order-1' : 'lg:order-2'} />
      </main>
    </div>
  )
}
