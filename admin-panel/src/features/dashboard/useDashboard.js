import { useEffect, useState } from 'react'
import { useApiResource } from '../../hooks/useApiResource'
import { useLiveRefresh } from '../workspace/useLiveRefresh'
import { useWorkspace } from '../workspace/useWorkspace'
import { dashboardApi } from './api'

export const REFRESH_MS = 60_000

// The dashboard for a chosen day (null = today) and the workspace's branch ('' = every branch the role covers),
// shared with the header's location filter. It reloads every minute while the page is visible, and again when the
// tab comes back into view. `syncedAt` is when the shown figures were last loaded.
export function useDashboard() {
  const [date, setDate] = useState(null)
  const { branchId, setBranchId } = useWorkspace()
  const { data, error, loading, reload } = useApiResource(
    () => dashboardApi.overview({ date: date ?? undefined, branchId: branchId || undefined }).then((view) => ({ view, syncedAt: Date.now() })),
    `dashboard:${date}:${branchId}`,
  )
  const [now, setNow] = useState(() => Date.now())
  useLiveRefresh(['appointments'], reload)

  useEffect(() => {
    const visible = () => document.visibilityState !== 'hidden'
    const timer = window.setInterval(() => {
      setNow(Date.now())
      if (visible()) reload()
    }, REFRESH_MS)
    const onVisible = () => {
      if (visible()) reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  // Keeps "Last synced 2m ago" moving between loads.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  return { view: data?.view ?? null, syncedAt: data?.syncedAt ?? null, error, loading, reload, date, setDate, branchId, setBranchId, now }
}
