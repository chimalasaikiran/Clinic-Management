import { useAuth } from '../../features/auth/context/useAuth'
import { useWorkspace } from '../../features/workspace/useWorkspace'
import { healthStatus } from '../../features/workspace/workspaceView'
import { cn } from '../../lib/cn'

// Only statements the system can stand behind: which organisation this is and whether the backend answered its
// last readiness check.
export default function WorkspaceFooter() {
  const { organisation } = useAuth()
  const health = healthStatus(useWorkspace().health)

  return (
    <footer className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-200 py-5 text-xs text-outline">
      <span className="font-semibold text-on-surface-variant">ClinicOS</span>
      {organisation && <span>{organisation.organisation.name}</span>}
      <span className={cn('flex items-center gap-1.5 font-medium', health.tone === 'danger' ? 'text-danger' : 'text-brand')}>
        <span className={cn('size-1.5 rounded-full', health.tone === 'danger' ? 'bg-danger' : 'bg-brand')} />
        Backend: {health.label}
      </span>
    </footer>
  )
}
