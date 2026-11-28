import { useState } from 'react'
import { useApiResource } from '../../../hooks/useApiResource'
import { useVisibleInterval } from '../../../hooks/useVisibleInterval'
import { useLiveRefresh } from '../../workspace/useLiveRefresh'
import { useWorkspace } from '../../workspace/useWorkspace'
import { dashboardApi } from '../api'

export const DAY_REFRESH_MS = 30_000

// The chosen day (null = today) at the workspace's branch, reloaded every 30 seconds while the page is visible.
// `act` runs a change, reports how it went and reloads, so buttons never leave stale rows behind.
export function useDay() {
  const [date, setDate] = useState(null)
  const { branchId, reloadAlerts } = useWorkspace()
  const { data, error, loading, reload } = useApiResource(
    () => dashboardApi.day({ date: date ?? undefined, branchId: branchId || undefined }).then((view) => ({ view, loadedAt: Date.now() })),
    `day:${date}:${branchId}`,
  )
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState(null)
  useVisibleInterval(reload, DAY_REFRESH_MS)
  useLiveRefresh(['appointments'], reload)

  const act = async (key, run, success) => {
    setBusy(key)
    setNotice(null)
    try {
      await run()
      setNotice({ tone: 'brand', text: success })
      reload()
      reloadAlerts?.()
      return true
    } catch (failure) {
      setNotice({ tone: 'danger', text: failure.message })
      // Someone else may have changed the record: show what it is now.
      reload()
      return false
    } finally {
      setBusy(null)
    }
  }

  // Waiting times are measured from the moment the figures were loaded.
  return { view: data?.view ?? null, now: data?.loadedAt ?? 0, error, loading, reload, date, setDate, act, busy, notice, setNotice }
}
