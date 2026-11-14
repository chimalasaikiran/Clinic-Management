import { useState } from 'react'
import { Plus, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, FilterTabs, InfoNote, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, StatTiles, Table, TableFooter } from '../../../components/workspace/DataTable'
import Avatar from '../../../components/workspace/Avatar'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../context/usePatient'
import FamilyDrawer from '../drawers/FamilyDrawer'

const TABS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'caregiver', label: 'Caregivers', test: (member) => member.caregiver.endsWith('Caregiver') },
  { id: 'emergency', label: 'Emergency Contacts', test: (member) => Boolean(member.emergencyTier) },
  { id: 'proxy', label: 'Authorized Proxies', test: (member) => member.access === 'Legal Proxy' },
  { id: 'inactive', label: 'Inactive / Former', test: (member) => member.status !== 'Active' },
]

const ACTION_LABEL = { 'Legal Proxy': 'Manage', 'Financial Sponsor / Co-pay': 'Billing' }

export default function FamilyTab() {
  const { patient, patientId, patients, mine, add, update, newId } = usePatient()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [relationship, setRelationship] = useState('')
  const [access, setAccess] = useState('')
  const [drawer, setDrawer] = useState(null)
  const members = mine('family')
  const proxy = members.find((member) => member.access === 'Legal Proxy')
  const selected = TABS.find((entry) => entry.id === tab)
  const needle = query.trim().toLowerCase()
  const rows = members.filter((member) => selected.test(member) && (!relationship || member.relationship === relationship) && (!access || member.access === access) && (!needle || `${member.name} ${member.mobile} ${member.relationship}`.toLowerCase().includes(needle)))
  const editing = drawer?.id ? members.find((member) => member.id === drawer.id) : null

  const save = (fields, id) => {
    if (id) return update('family', id, fields)
    const seq = members.length + 1
    add('family', { ...fields, id: newId('FAM-', 'family', 5), patientId, personCode: `#PER-${String(900 + seq).padStart(5, '0')}`, consentId: fields.access === 'Legal Proxy' ? `#CONS-2026-${9040 + seq}` : null })
  }

  if (!members.length) {
    return (
      <div>
        <h2 className="mb-1 text-2xl font-bold">Family &amp; Caregiver</h2>
        <p className="mb-4 text-sm text-on-surface-variant">Manage family relationships, designated caregivers, emergency contacts, and authorized legal representatives for this patient.</p>
        <EmptyState icon={Users} title="No family or caregivers linked" action={<ActionButton variant="primary" icon={Plus} onClick={() => setDrawer({ type: 'form' })}>Add person</ActionButton>}>{patient.name} has no linked family members, emergency contacts or legal representatives.</EmptyState>
        <FamilyDrawer key="new" open={drawer?.type === 'form'} onClose={() => setDrawer(null)} patient={patient} member={null} patients={patients} onSave={save} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-2xl font-bold">Family &amp; Caregiver <StatusPill tone="brand">{members.length} Linked Entities</StatusPill></h2><p className="text-sm text-on-surface-variant">Manage family relationships, designated caregivers, emergency contacts, and authorized legal representatives for this patient.</p></div>
        <ActionButton variant="primary" icon={Plus} onClick={() => setDrawer({ type: 'form' })}>Add person</ActionButton>
      </div>

      <StatTiles
        className="mb-5 lg:grid-cols-4"
        items={[
          { label: 'Family members', value: `${members.length} Linked`, hint: [...new Set(members.map((member) => member.relationship))].join(', ') },
          { label: 'Caregivers', value: `${members.filter(TABS[1].test).length} Primary Caregiver`.replace(/^0 .*/, 'None assigned'), hint: members.find(TABS[1].test)?.caregiverNote ?? '' },
          { label: 'Emergency contacts', value: `${members.filter(TABS[2].test).length} Registered`, hint: members.filter(TABS[2].test).map((member) => member.emergencyTier).join(' & ') },
          { label: 'Authorized representatives', value: `${members.filter(TABS[3].test).length} Legal Proxy`, hint: proxy ? 'ABDM consent artefact active' : 'None designated' },
        ]}
      />

      {proxy && (
        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" /><div><p className="text-xs font-semibold tracking-wide uppercase">Active legal proxy &amp; primary caregiver <StatusPill tone="warning">Valid consent</StatusPill></p><p className="mt-1 text-xs"><strong>{proxy.name}</strong> ({proxy.relationship}) holds a valid ABDM digital consent proxy <span className="font-mono">{proxy.consentId}</span> authorized for {proxy.scope}.</p></div></div>
          <div className="flex gap-2"><ActionButton size="sm" onClick={() => setDrawer({ type: 'form', id: proxy.id })}>Manage Access Scope</ActionButton><Link to={pathFor(ROUTES.patientCommunication, { patientId })} state={{ view: 'consents' }} className="self-center text-xs font-semibold text-brand hover:underline">View Consent Artifact →</Link></div>
        </section>
      )}

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2"><SearchBox value={query} onChange={setQuery} label="Search family" placeholder="Search by person name, phone, relationship…" className="w-80 max-w-full" /><FilterSelect label="Relationship" value={relationship} onChange={setRelationship} allLabel="All Relationships" options={[...new Set(members.map((member) => member.relationship))]} /><FilterSelect label="Access type" value={access} onChange={setAccess} allLabel="All Access Types" options={[...new Set(members.map((member) => member.access))]} /></div>
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-xs text-on-surface-variant">Filter view: <FilterTabs label="Linked person group" value={tab} onChange={setTab} options={TABS.map((entry) => ({ id: entry.id, label: entry.label, count: members.filter(entry.test).length }))} /></div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table headings={['Person & ID', 'Relationship', 'Contact & location', 'Caregiver role', 'Emergency contact', 'Authorized access & consent', 'Status', 'Actions']} minWidth={1120} empty={rows.length ? null : 'No linked persons match the current filters.'}>
          {rows.map((member) => (
            <Row key={member.id}>
              <Cell><div className="flex items-center gap-3"><Avatar initials={member.initials} tone="teal" /><div><p className="font-semibold">{member.name}</p><p className="text-[11px] text-on-surface-variant">{member.age ? `${member.age} yrs · ` : ''}{member.gender}</p><p className="font-mono text-[10px] text-outline">{member.personCode}</p></div></div></Cell>
              <Cell><StatusPill>{member.relationship}</StatusPill><p className="mt-1 text-[11px] text-brand">{member.kinship}</p></Cell>
              <Cell className="text-xs"><p>{member.mobile}</p><p className="text-on-surface-variant">{member.email}</p><p className="text-on-surface-variant">{member.location}</p></Cell>
              <Cell><StatusPill tone={member.caregiver === 'Non-caregiver' ? 'neutral' : 'brand'}>{member.caregiver}</StatusPill><p className="mt-1 text-[11px] text-on-surface-variant">{member.caregiverNote}</p></Cell>
              <Cell>{member.emergencyTier ? <StatusPill tone="danger">{member.emergencyTier}</StatusPill> : <StatusPill>Not Registered</StatusPill>}<p className="mt-1 text-[11px] text-on-surface-variant">{member.emergencyNote}</p></Cell>
              <Cell><StatusPill tone={member.access === 'Legal Proxy' ? 'brand' : member.access.startsWith('Financial') ? 'info' : 'neutral'}>{member.access}</StatusPill>{member.consentId && <p className="font-mono text-[10px] text-outline">{member.consentId}</p>}<p className="mt-1 text-[11px]">Scope: {member.scope}</p><p className="text-[11px] text-brand">{member.portal}</p></Cell>
              <Cell><StatusPill tone={member.status === 'Active' ? 'success' : 'neutral'} dot>{member.status}</StatusPill></Cell>
              <Cell><ActionButton size="sm" onClick={() => setDrawer({ type: 'form', id: member.id })} aria-label={`${ACTION_LABEL[member.access] ?? 'Edit'} ${member.name}`}>{ACTION_LABEL[member.access] ?? 'Edit'}</ActionButton></Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${members.length} linked individuals`}><ActionButton size="sm" icon={Plus} onClick={() => setDrawer({ type: 'form' })}>Add Person</ActionButton></TableFooter>
      </div>
      <InfoNote className="mt-5"><strong>ABDM Personal Health Records (PHR) &amp; DISHA compliance notice:</strong> relationship mapping complies with DISHA privacy guidelines 2024 and ABDM Milestone 2. Proxy directives. Emergency contacts do not receive clinical EMR access without independent verified patient consent.</InfoNote>

      <FamilyDrawer key={drawer?.id ?? 'new'} open={drawer?.type === 'form'} onClose={() => setDrawer(null)} patient={patient} member={editing} patients={patients} onSave={save} />
    </div>
  )
}
