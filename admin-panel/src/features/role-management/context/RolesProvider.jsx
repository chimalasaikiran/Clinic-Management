import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { OWNER } from '../../../config/workspace'
import { ROLES } from '../data/roles'
import { RolesContext } from './rolesContext'

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const stamp = () => ({
  modifiedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  modifiedBy: OWNER.name,
})

// Holds roles in memory so a role created or edited on one screen shows up on the next.
// It is replaced by API calls once the access-control backend exists.
export default function RolesProvider({ children }) {
  const [roles, setRoles] = useState(ROLES)

  const addRole = useCallback(
    (values) => {
      const baseId = slugify(values.name) || 'role'
      const taken = roles.filter((entry) => entry.id.startsWith(baseId)).length
      const role = {
        id: taken ? `${baseId}-${taken + 1}` : baseId,
        name: values.name.trim(),
        category: values.category,
        users: 0,
        scope: values.scope,
        branchIds: values.scope === 'branch' ? values.branchIds : [],
        status: values.status,
        description: values.description.trim(),
        permissions: values.permissions,
        createdBy: OWNER.name,
        ...stamp(),
      }
      setRoles((current) => [...current, role])
      return role
    },
    [roles],
  )

  const updateRole = useCallback((id, changes) => {
    setRoles((current) => current.map((role) => (role.id === id ? { ...role, ...changes, ...stamp() } : role)))
  }, [])

  const value = useMemo(
    () => ({ roles, getRole: (id) => roles.find((role) => role.id === id), addRole, updateRole }),
    [roles, addRole, updateRole],
  )

  return <RolesContext.Provider value={value}>{children ?? <Outlet />}</RolesContext.Provider>
}
