import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { accessApi } from '../../auth/api'
import { useAuth } from '../../auth/context/useAuth'
import { RolesContext } from './rolesContext'

const STATUS_LABELS = { draft: 'Draft', active: 'Active', inactive: 'Inactive' }
const STATUS_VALUES = { Draft: 'draft', Active: 'active', Inactive: 'inactive' }

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// The API's role, in the shape the role screens were built around.
const fromApi = (role) => ({
  id: role.id,
  name: role.name,
  category: role.category,
  system: role.isSystem,
  users: role.users,
  scope: role.scope,
  branchIds: role.branchIds,
  status: STATUS_LABELS[role.status],
  description: role.description,
  permissions: role.permissions,
  createdBy: role.createdBy ?? 'System',
  modifiedOn: formatDate(role.updatedAt),
  modifiedBy: role.updatedBy ?? 'System',
  version: role.version,
})

const toApi = (values) => {
  const body = {}
  for (const key of ['name', 'category', 'scope', 'branchIds', 'description', 'permissions']) {
    if (values[key] !== undefined) body[key] = typeof values[key] === 'string' ? values[key].trim() : values[key]
  }
  if (values.status) body.status = STATUS_VALUES[values.status]
  return body
}

const fetchRoles = () =>
  Promise.all([accessApi.roles(), accessApi.branches()]).then(
    ([roles, branches]) => ({ status: 'ready', roles: roles.map(fromApi), branches, error: '' }),
    (error) => ({ status: 'error', roles: [], branches: [], error: error.message }),
  )

// Roles and branches for the signed-in organisation. Every change goes through the API, which applies
// the same grant rules as the screens and records who changed what.
export default function RolesProvider({ children }) {
  const { orgId } = useAuth()
  const [state, setState] = useState({ status: 'loading', roles: [], branches: [], error: '' })

  const load = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: '' }))
    return fetchRoles().then(setState)
  }, [])

  // Load on mount and whenever the active organisation changes; a late reply for an old one is ignored.
  useEffect(() => {
    let current = true
    fetchRoles().then((next) => current && setState(next))
    return () => {
      current = false
    }
  }, [orgId])

  const addRole = useCallback(async (values) => {
    const role = fromApi(await accessApi.createRole(toApi(values)))
    setState((current) => ({ ...current, roles: [...current.roles, role] }))
    return role
  }, [])

  const updateRole = useCallback(
    async (id, changes) => {
      const current = state.roles.find((role) => role.id === id)
      try {
        const role = fromApi(await accessApi.updateRole(id, { ...toApi(changes), version: current.version }))
        setState((existing) => ({ ...existing, roles: existing.roles.map((entry) => (entry.id === id ? role : entry)) }))
        return role
      } catch (error) {
        // Someone else changed the role: show their version so the next attempt starts from it.
        if (error.code === 'VERSION_CONFLICT') load()
        throw error
      }
    },
    [state.roles, load],
  )

  const value = useMemo(
    () => ({ roles: state.roles, branches: state.branches, getRole: (id) => state.roles.find((role) => role.id === id), addRole, updateRole, reload: load }),
    [state.roles, state.branches, addRole, updateRole, load],
  )

  if (state.status !== 'ready') {
    return (
      <WorkspacePage>
        <div role="status" className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center text-sm text-on-surface-variant">
          {state.status === 'loading' ? (
            'Loading roles…'
          ) : (
            <>
              <p>{state.error}</p>
              <button type="button" onClick={load} className="font-semibold text-brand hover:underline">
                Try again
              </button>
            </>
          )}
        </div>
      </WorkspacePage>
    )
  }

  return <RolesContext.Provider value={value}>{children ?? <Outlet />}</RolesContext.Provider>
}
