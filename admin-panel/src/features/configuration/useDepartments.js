import { useApiResource } from '../../hooks/useApiResource'
import { configApi } from './api'

// The active departments from Configuration › Departments, by name, for the forms that choose one. `current`
// keeps a record's existing department in the list even if it was deactivated since.
export function useDepartmentNames(current) {
  const resource = useApiResource(() => configApi.departments({ status: 'active' }), 'departments-active')
  const names = (resource.data ?? []).map((department) => department.name)
  return { names: current && !names.some((name) => name.toLowerCase() === current.toLowerCase()) ? [current, ...names] : names, loaded: Boolean(resource.data), error: resource.error }
}
