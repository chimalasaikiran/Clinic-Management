import Button from '../../../components/ui/Button'

// Full-page state shown while the session loads, or when it cannot be loaded.
export default function AuthStatusScreen({ title, message, action, onAction }) {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-surface-lowest px-4 font-inter">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        {!action && <span aria-hidden="true" className="size-6 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />}
        <h1 className="text-base font-semibold text-on-surface">{title}</h1>
        {message && <p className="text-sm leading-6 text-on-surface-variant">{message}</p>}
        {action && (
          <Button onClick={onAction} className="mt-2">
            {action}
          </Button>
        )}
      </div>
    </div>
  )
}
