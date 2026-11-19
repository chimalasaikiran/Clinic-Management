import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApiResource } from '../../hooks/useApiResource'
import { useVisibleInterval } from '../../hooks/useVisibleInterval'
import { useAuth } from '../auth/context/useAuth'
import { workspaceApi } from './api'
import { WorkspaceContext } from './workspaceContext'
import { permittedBranches } from './workspaceView'

export const REFRESH_MS = 60_000
const BRANCH_KEY = 'clinicos.workspace.branch'

// The chosen branch is a per-browser convenience; without storage it is simply not remembered.
const readBranch = (orgId) => {
  try {
    return window.localStorage.getItem(`${BRANCH_KEY}:${orgId}`) ?? ''
  } catch {
    return ''
  }
}
const writeBranch = (orgId, branchId) => {
  try {
    if (branchId) window.localStorage.setItem(`${BRANCH_KEY}:${orgId}`, branchId)
    else window.localStorage.removeItem(`${BRANCH_KEY}:${orgId}`)
  } catch {
    // storage blocked: the choice lasts until the page reloads
  }
}

// Times the backend's readiness check (it also reaches the database). A failure is a result, not an error.
const checkHealth = () => {
  const started = performance.now()
  return workspaceApi.health().then(
    () => ({ ok: true, ms: Math.round(performance.now() - started) }),
    () => ({ ok: false }),
  )
}

// State shared by the header, the sidebar and the pages of the signed-in workspace: the branch the person is
// working in ('' = every branch their roles cover), the open items behind the alerts and the backend's health.
export default function WorkspaceProvider({ children }) {
  const { orgId, organisation } = useAuth()
  const { pathname } = useLocation()
  const branchScope = organisation?.branchScope
  const list = useApiResource(() => workspaceApi.branches(), `workspace-branches:${orgId}`)
  const [choice, setChoice] = useState(() => ({ orgId, value: readBranch(orgId) }))
  const stored = choice.orgId === orgId ? choice.value : readBranch(orgId)

  const branchesLoaded = Boolean(list.data)
  const branches = useMemo(() => permittedBranches(list.data, branchScope), [list.data, branchScope])
  // A remembered branch the person no longer covers (role changed, branch closed) falls back to all of them.
  const branchId = branchesLoaded && !branches.some((branch) => branch.id === stored) ? '' : stored

  const alerts = useApiResource(() => workspaceApi.alerts({ branchId: branchId || undefined }), `alerts:${orgId}:${branchId}`)
  const health = useApiResource(checkHealth, 'health')
  const { reload: reloadAlerts } = alerts
  useVisibleInterval(() => {
    reloadAlerts()
    health.reload()
  }, REFRESH_MS)

  // Handling an item happens on another page; coming back from it should not show the old count.
  const shownPath = useRef(pathname)
  useEffect(() => {
    if (shownPath.current === pathname) return
    shownPath.current = pathname
    reloadAlerts()
  }, [pathname, reloadAlerts])

  const value = useMemo(
    () => ({
      branches,
      branchesLoaded,
      branchId,
      setBranchId: (next) => {
        writeBranch(orgId, next)
        setChoice({ orgId, value: next })
      },
      alerts: alerts.data,
      reloadAlerts,
      health: health.data,
    }),
    [branches, branchesLoaded, branchId, orgId, alerts.data, reloadAlerts, health.data],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
