import { useState } from 'react'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { accessApi } from '../../auth/api'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import AccessStatusDrawer from '../components/AccessStatusDrawer'
import MemberRolesDrawer from '../components/MemberRolesDrawer'
import { useRoles } from '../context/useRoles'

const STATUSES = {
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'warning' },
  removed: { label: 'Removed', tone: 'neutral' },
}

// Everyone who can sign in to this organisation, with the roles that decide what they can do.
export default function MembersPage() {
  const { user, orgId } = useAuth()
  const { roles, branches, refresh } = useRoles()
  const members = useApiResource(() => accessApi.members(), `members#${orgId}`)
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [role, setRole] = useState('')
  const [editing, setEditing] = useState(null)
  const [changingAccess, setChangingAccess] = useState(null)
  const [notice, setNotice] = useState('')

  if (!members.data) {
    return (
      <WorkspacePage>
        <LoadingState label="Loading members…" error={members.error} onRetry={members.reload} />
      </WorkspacePage>
    )
  }

  const search = query.trim().toLowerCase()
  const rows = members.data.filter(
    (member) =>
      (!search || `${member.user.fullName} ${member.user.email}`.toLowerCase().includes(search)) &&
      (!role || member.roles.some((entry) => entry.name === role)),
  )

  const saved = (message) => {
    setEditing(null)
    setChangingAccess(null)
    setNotice(message)
    members.reload()
    refresh()
  }

  const open = (setter, member) => {
    setNotice('')
    setter(member)
  }

  return (
    <WorkspacePage>
      <PageIntro
        title="Members"
        description="Everyone who can sign in to this organisation. Their roles decide what they can see and do in the admin panel and the staff app."
        actions={
          <ActionButton icon={ArrowLeft} to={ROUTES.roles}>
            Back to roles
          </ActionButton>
        }
      />

      {notice && (
        <Banner tone="brand" className="mb-5">
          {notice}
        </Banner>
      )}
      {members.error && (
        <Banner tone="danger" className="mb-5">
          This list may be out of date: {members.error.message}
        </Banner>
      )}

      <section className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <SearchBox value={query} onChange={setQuery} label="Search members" placeholder="Search by name or email…" className="min-w-60 flex-1" />
        <FilterSelect label="Role" value={role} onChange={setRole} allLabel="Role: All roles" options={roles.map((entry) => entry.name)} />
      </section>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table headings={['Person', 'Roles', 'Access', 'Actions']} empty={rows.length ? null : 'No members match your filters.'}>
          {rows.map((member) => {
            const name = member.user.fullName
            const self = member.user.id === user.id
            return (
              <Row key={member.id}>
                <Cell>
                  <p className="font-semibold">{name}</p>
                  <p className="text-[11px] text-outline">{member.user.email}</p>
                </Cell>
                <Cell>
                  <div className="flex flex-wrap gap-1.5">
                    {member.roles.length ? (
                      member.roles.map((entry) => (
                        <StatusPill key={entry.id} tone="info">
                          {entry.name}
                        </StatusPill>
                      ))
                    ) : (
                      <StatusPill tone="warning">No role</StatusPill>
                    )}
                  </div>
                </Cell>
                <Cell>
                  <StatusPill tone={STATUSES[member.status].tone}>{STATUSES[member.status].label}</StatusPill>
                </Cell>
                <Cell>
                  {self ? (
                    <p className="text-xs text-on-surface-variant">This is you. Another role manager must change your access.</p>
                  ) : member.status === 'removed' ? (
                    <p className="text-xs text-on-surface-variant">No longer a member.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <ActionButton size="sm" onClick={() => open(setEditing, member)} aria-label={`Change roles for ${name}`}>
                        Change roles
                      </ActionButton>
                      <ActionButton
                        size="sm"
                        variant={member.status === 'active' ? 'danger' : 'secondary'}
                        onClick={() => open(setChangingAccess, member)}
                        aria-label={`${member.status === 'active' ? 'Suspend' : 'Reactivate'} ${name}`}
                      >
                        {member.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </ActionButton>
                    </div>
                  )}
                </Cell>
              </Row>
            )
          })}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${members.data.length} ${members.data.length === 1 ? 'member' : 'members'}`}>
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Every change is recorded in the audit log.
          </p>
        </TableFooter>
      </div>

      {editing && <MemberRolesDrawer member={editing} roles={roles} branches={branches} onClose={() => setEditing(null)} onSaved={saved} />}
      {changingAccess && <AccessStatusDrawer member={changingAccess} onClose={() => setChangingAccess(null)} onSaved={saved} />}
    </WorkspacePage>
  )
}
