import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiConfigured, configureApi } from '../../../lib/api'
import { authApi } from '../api'
import { AuthContext } from './authContext'

const ORG_KEY = 'clinicos.activeOrg'
const IDLE_LIMIT_MS = 30 * 60 * 1000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart']

const SIGNED_OUT = { status: 'signedOut', user: null, memberships: [], orgId: null }

// The active organisation id is not sensitive; storage may be unavailable, which only means it is not remembered.
const readOrg = () => {
  try {
    return window.localStorage.getItem(ORG_KEY)
  } catch {
    return null
  }
}
const writeOrg = (id) => {
  try {
    if (id) window.localStorage.setItem(ORG_KEY, id)
    else window.localStorage.removeItem(ORG_KEY)
  } catch {
    // storage blocked: the choice simply is not remembered
  }
}

// status: loading → signedOut | unverified | noOrganisation | ready, or error / misconfigured.
// The session itself is an HttpOnly cookie owned by the backend; this only mirrors what the backend reports.
// Permissions shown here only shape the UI; the backend checks them again on every request.
function initialState() {
  if (apiConfigured()) return { ...SIGNED_OUT, status: 'loading', endedReason: null, error: null }
  return { ...SIGNED_OUT, status: 'misconfigured', endedReason: null, error: 'VITE_API_URL is not set. Copy admin-panel/.env.example to .env.local.' }
}

export default function AuthProvider({ children }) {
  const [state, setState] = useState(initialState)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const applySession = useCallback((session, preferredOrgId) => {
    const memberships = session.memberships ?? []
    const wanted = preferredOrgId ?? readOrg()
    const orgId = memberships.some((entry) => entry.organisation.id === wanted) ? wanted : (memberships[0]?.organisation.id ?? null)
    const status = !session.user.emailVerified ? 'unverified' : memberships.length ? 'ready' : 'noOrganisation'
    writeOrg(orgId)
    setState({ status, user: session.user, memberships, orgId, endedReason: null, error: null })
    // Callers navigate right away, before the new state renders, so they get the fresh permissions here.
    const permissions = new Set(memberships.find((entry) => entry.organisation.id === orgId)?.permissions ?? [])
    return { status, can: (permission) => permissions.has(permission) }
  }, [])

  const refresh = useCallback(async (preferredOrgId) => applySession(await authApi.session(), preferredOrgId), [applySession])

  // Forgets the session locally and asks the backend to end it and clear the cookie (harmless if it already ended).
  const endSession = useCallback(async (reason = null) => {
    writeOrg(null)
    setState({ ...SIGNED_OUT, endedReason: reason, error: null })
    await authApi.logout().catch(() => {})
  }, [])

  useEffect(() => {
    configureApi({
      getOrgId: () => stateRef.current.orgId,
      onSessionEnded: (code) => {
        if (stateRef.current.status !== 'signedOut') endSession(code)
      },
    })
    if (stateRef.current.status === 'misconfigured') return undefined

    let active = true
    // Restore the session from the cookie on load. No cookie or an ended session simply means signed out.
    authApi
      .session()
      .then((session) => active && applySession(session))
      .catch((error) => {
        if (!active) return
        if (error.status === 401 || error.status === 403) setState((current) => ({ ...SIGNED_OUT, endedReason: current.endedReason, error: null }))
        else setState((current) => ({ ...current, status: 'error', error: error.message }))
      })
    return () => {
      active = false
    }
  }, [applySession, endSession])

  // Sign out after a period without activity, so an unattended desk does not stay signed in.
  // The backend enforces the same idle limit on its side.
  const signedIn = ['ready', 'noOrganisation', 'unverified'].includes(state.status)
  useEffect(() => {
    if (!signedIn) return undefined
    let lastActivity = Date.now()
    const touch = () => {
      lastActivity = Date.now()
    }
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, touch, { passive: true }))
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity > IDLE_LIMIT_MS) endSession('IDLE')
    }, 30_000)
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, touch))
      window.clearInterval(timer)
    }
  }, [signedIn, endSession])

  // Errors carry the backend's plain-language message ("Email or password is incorrect.", rate limits, lockout).
  const signIn = useCallback(async (email, password) => applySession(await authApi.login(email, password)), [applySession])

  const signOut = useCallback(
    async ({ everywhere = false } = {}) => {
      // Sign out everywhere first: if it fails the user is told and stays signed in, rather than believing it worked.
      if (everywhere) await authApi.logoutEverywhere()
      await endSession(null)
    },
    [endSession],
  )

  const value = useMemo(() => {
    const organisation = state.memberships.find((entry) => entry.organisation.id === state.orgId) ?? null
    const permissions = new Set(organisation?.permissions ?? [])
    const can = (permission) => permissions.has(permission)
    return {
      ...state,
      organisation,
      permissions,
      can,
      canAny: (list) => list.some(can),
      signIn,
      signOut,
      refresh,
      selectOrganisation: (orgId) => {
        writeOrg(orgId)
        setState((current) => ({ ...current, orgId }))
      },
    }
  }, [state, signIn, signOut, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
