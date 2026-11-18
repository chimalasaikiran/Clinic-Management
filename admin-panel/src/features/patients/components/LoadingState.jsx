import { AlertTriangle, Loader2 } from 'lucide-react'

// Placeholder while patient or appointment data loads, or the reason it could not be loaded.
export default function LoadingState({ label = 'Loading…', error, onRetry }) {
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50/60 px-6 py-10 text-center">
        <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
        <p className="text-sm font-semibold text-on-surface">Could not load this information</p>
        <p className="max-w-md text-xs text-on-surface-variant">{error.message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="text-xs font-semibold text-brand hover:underline">
            Try again
          </button>
        )}
      </div>
    )
  }
  return (
    <p role="status" className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-10 text-sm text-on-surface-variant">
      <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" />
      {label}
    </p>
  )
}
