import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { homePath } from '../../../config/access'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { useAuth } from '../context/useAuth'

export default function AccessDeniedPage() {
  const auth = useAuth()
  const home = homePath(auth.can)

  return (
    <WorkspacePage>
      <section className="mx-auto flex max-w-lg flex-col items-center gap-3 py-24 text-center">
        <ShieldAlert className="size-8 text-outline" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-on-surface">You do not have access to this page</h1>
        <p className="text-sm leading-6 text-on-surface-variant">
          Your role in {auth.organisation?.organisation.name ?? 'this organisation'} does not include this section. Ask your clinic administrator if you need it.
        </p>
        {home && (
          <Link to={home} className="mt-2 text-sm font-semibold text-brand hover:underline">
            Go to your workspace
          </Link>
        )}
      </section>
    </WorkspacePage>
  )
}
