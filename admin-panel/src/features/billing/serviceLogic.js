import { isBlank } from '../../lib/validators'
import { formatINR } from '../patients/format'
import { BRANCHES, TAX_CONFIGS } from './constants'

export const blankService = () => ({
  name: '', code: '', category: '', department: '', description: '', status: 'Inactive', price: '', tax: 'Not configured', taxConfig: '',
  branches: Object.fromEntries(BRANCHES.map((branch) => [branch.id, { offered: false, mode: 'default', price: '' }])),
})

// Form state for an existing service: offered branches with their price mode.
export function formFromService(service) {
  return {
    ...blankService(), ...service, price: String(service.price),
    branches: Object.fromEntries(BRANCHES.map((branch) => {
      const entry = service.branches[branch.id]
      return [branch.id, entry ? { offered: true, mode: entry.price == null ? 'default' : 'custom', price: entry.price == null ? '' : String(entry.price) } : { offered: false, mode: 'default', price: '' }]
    })),
  }
}

export const offeredBranches = (values) => BRANCHES.filter((branch) => values.branches[branch.id].offered)

// What an offered branch charges: its custom amount or the service default.
export const effectivePrice = (service, branchId) => {
  const entry = service.branches[branchId]
  if (!entry) return null
  return entry.price == null ? service.price : entry.price
}

const isAmount = (value) => String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0

// An active service must have a tax decision and at least one branch; an inactive draft may stay incomplete.
export function validateService(values, services, editingId) {
  const errors = {}
  const code = values.code.trim()
  if (isBlank(values.name)) errors.name = 'Enter the service name.'
  if (isBlank(code)) errors.code = 'Enter a unique service code.'
  else if (services.some((entry) => entry.id !== editingId && entry.code.toLowerCase() === code.toLowerCase())) errors.code = 'This service code is already used in Aura Health.'
  if (!values.category) errors.category = 'Choose the service category.'
  if (!isAmount(values.price)) errors.price = 'Enter the default price. Use 0 only for an explicit free service; blank and negative prices are not valid.'
  if ((values.tax === 'Exempt' || values.tax === 'Taxable') && !values.taxConfig) errors.taxConfig = 'Choose the applicable organization tax configuration.'
  if (values.status === 'Active') {
    if (values.tax === 'Not configured') errors.tax = 'Choose a tax treatment before activating. “Not configured” is not a tax decision.'
    if (offeredBranches(values).length === 0) errors.branches = 'Select at least one location before activating this service.'
  }
  const badOverride = BRANCHES.find((branch) => values.branches[branch.id].offered && values.branches[branch.id].mode === 'custom' && !isAmount(values.branches[branch.id].price))
  if (badOverride) errors.branches = `Enter a valid non-negative price for the ${badOverride.name} override.`
  return errors
}

export function buildService(values, { id, audit = [], stamp }) {
  const code = values.code.trim().toUpperCase()
  const branches = Object.fromEntries(offeredBranches(values).map((branch) => {
    const entry = values.branches[branch.id]
    return [branch.id, { available: true, price: entry.mode === 'custom' ? Number(entry.price) : null }]
  }))
  return {
    id: id ?? code.toLowerCase(), code, name: values.name.trim(), category: values.category, department: values.department, description: values.description.trim(), status: values.status,
    price: Number(values.price), tax: values.tax, taxConfig: TAX_CONFIGS[values.tax] ? values.taxConfig : '', branches, updated: stamp, audit,
    unit: values.unit,
  }
}

export const changedFields = (before, after) =>
  ['name', 'code', 'category', 'department', 'description', 'status', 'price', 'tax', 'taxConfig', 'branches'].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))

// Reactivation re-runs the configuration checks that activation needs.
export function activationBlockers(service) {
  const blockers = []
  if (service.tax === 'Not configured') blockers.push('Choose a tax treatment')
  if (Object.keys(service.branches).length === 0) blockers.push('Select at least one location')
  return blockers
}

// Where a service is offered and at what price, as the catalogue shows it.
export const branchSummary = (service) => {
  const offered = BRANCHES.filter((branch) => service.branches[branch.id])
  if (offered.length === 0) return ['Not configured', 'No location configured']
  const names = offered.length === BRANCHES.length ? `All ${BRANCHES.length} locations` : offered.map((branch) => branch.short).join(' · ')
  const custom = offered.filter((branch) => service.branches[branch.id].price != null)
  return [names, custom.length ? `Custom price at ${custom.map((branch) => `${branch.short} ${formatINR(service.branches[branch.id].price)}`).join(', ')}` : 'Default price at every offered location']
}
