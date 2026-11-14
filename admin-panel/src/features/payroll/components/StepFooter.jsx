import { ArrowLeft, ArrowRight } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'

// Bottom bar of a run step: a one-line summary, then back / next navigation.
export default function StepFooter({ summary, back, next, nextLabel, nextDisabled, children }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3">
      <p className="text-xs text-on-surface-variant">{summary}</p>
      <div className="flex flex-wrap items-center gap-2">
        {back && (
          <ActionButton icon={ArrowLeft} to={back.to}>
            {back.label}
          </ActionButton>
        )}
        {children}
        {next && (
          <ActionButton variant="primary" to={nextDisabled ? undefined : next} disabled={nextDisabled}>
            {nextLabel}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </ActionButton>
        )}
      </div>
    </div>
  )
}
