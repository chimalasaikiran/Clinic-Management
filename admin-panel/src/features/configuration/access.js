// Who can work at a branch: access comes from roles. An organisation-wide role covers every branch; a
// branch-limited role covers the branches it lists.

export const ACCESS_LEVEL_TONES = { Full: 'success', Work: 'warning', 'View only': 'neutral' }

export const ACCESS_TIERS = [
  { id: 'full', tone: 'bg-emerald-500', title: 'Full Access', detail: 'Holds a role that can change organisation settings or roles. Usually owners and branch administrators.', foot: 'Can change who has access' },
  { id: 'work', tone: 'bg-amber-500', title: 'Work Access', detail: 'Can do day-to-day work: registration, booking, consultations, billing, dispensing, depending on the role’s permissions.', foot: 'Exactly what the role’s permissions allow' },
  { id: 'view', tone: 'bg-slate-500', title: 'View Only', detail: 'Can look at records the role covers but not change them. Useful for auditors and inspection.', foot: 'Only .view permissions' },
]
const RANK = { 'View only': 0, Work: 1, Full: 2 }

export const coversBranch = (role, branchId) => role.status === 'active' && (role.scope === 'org' || role.branchIds.includes(branchId))

// Full: can change the organisation's settings or roles. Work: can do anything beyond viewing. View only otherwise.
export function accessLevel(permissions) {
  if (permissions.some((permission) => permission === 'settings.roles' || permission === 'settings.organisation')) return 'Full'
  if (permissions.some((permission) => !permission.endsWith('.view'))) return 'Work'
  return 'View only'
}

// One row per member with at least one role covering any of `branchIds`.
export function accessRoster(members, roles, branchIds) {
  const byId = new Map(roles.map((role) => [role.id, role]))
  return members.flatMap((member) => {
    const covering = member.roles.map((entry) => byId.get(entry.id)).filter((role) => role && branchIds.some((branchId) => coversBranch(role, branchId)))
    if (!covering.length) return []
    const level = covering.map((role) => accessLevel(role.permissions)).sort((a, b) => RANK[b] - RANK[a])[0]
    return [{ member, roles: covering, level, source: covering.some((role) => role.scope === 'org') ? 'Organisation-wide role' : 'Branch role' }]
  })
}
