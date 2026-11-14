import { useContext } from 'react'
import { RolesContext } from './rolesContext'

export function useRoles() {
  const value = useContext(RolesContext)
  if (!value) throw new Error('useRoles must be used inside RolesProvider')
  return value
}
