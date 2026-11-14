import { useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Lock, Pencil, Save } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, Toggle } from '../../../components/workspace/controls'
import { Cell, Row, Table } from '../../../components/workspace/DataTable'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { pathFor, ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import PersonBanner from '../components/PersonBanner'
import StaffNotFound from '../components/StaffNotFound'
import { ANANYA as ananya, OPD_SCHEDULE, OPD_SERVICES } from '../data/ananya'

const NEW_SESSION = '04:30 PM – 07:30 PM|15m · Max 12|Ch. 104'
const MAX_SESSIONS = 3

const initialDays = () => Object.fromEntries(OPD_SCHEDULE.map((day) => [day.day, { on: day.on, sessions: day.sessions ?? [] }]))

function SessionChip({ value }) {
  const [time, detail, chamber] = value.split('|')
  return (
    <li className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-surface-lowest px-3 py-1.5 text-xs">
      <span className="font-mono font-semibold text-on-surface">{time}</span>
      <span className="text-outline">{detail}</span>
      {chamber && <span className="text-[10px] text-outline">{chamber}</span>}
    </li>
  )
}

function DayRow({ day, state, onToggle, onAddSession }) {
  const { on, sessions } = state

  return (
    <li className={cn('flex flex-wrap items-start gap-4 px-5 py-4', !on && 'bg-surface-lowest')}>
      <div className="flex w-36 items-start gap-3">
        <Toggle checked={on} onChange={onToggle} label={`${day.day} OPD`} />
        <div>
          <p className="text-[13px] font-semibold text-on-surface">{day.day}</p>
          <p className={cn('text-[11px]', on ? 'text-brand' : 'text-outline')}>{on ? day.note.replace(/^Inactive Here|^OFF \/ Inactive/, 'Active') : day.note}</p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {on && sessions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <SessionChip key={session} value={session} />
            ))}
          </ul>
        )}
        {on && day.verified && <p className="mt-2 flex items-center justify-end gap-1 text-[11px] text-brand"><Check className="size-3" aria-hidden="true" />Operating window verified</p>}
        {on && day.warning && (
          <p className="mt-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><Lock className="mt-0.5 size-3.5" aria-hidden="true" />{day.warning}</p>
        )}
        {on && day.alert && (
          <p className="mt-2 flex items-start gap-2 text-xs text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{day.alert}</p>
        )}
        {!on && day.assigned && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="rounded border border-slate-200 bg-surface-high px-3 py-1.5 text-xs font-medium text-on-surface">{day.assigned}</p>
            <p className="text-[11px] text-outline">{day.aside}</p>
          </div>
        )}
        {!on && !day.assigned && day.aside && <p className="text-xs text-outline italic">{day.aside}</p>}
      </div>

      <div className="flex items-center gap-3 text-xs">
        {on && sessions.length < MAX_SESSIONS && (
          <button type="button" onClick={onAddSession} className="font-semibold text-brand hover:underline">+ Add Session</button>
        )}
        {on && <Pencil className="size-3.5 text-outline" aria-hidden="true" />}
        {!on && day.enable && <button type="button" onClick={onToggle} className="font-semibold text-brand hover:underline">Enable Day</button>}
        {!on && day.assigned && <button type="button" onClick={onToggle} className="font-medium underline">Override</button>}
      </div>
    </li>
  )
}

export default function OpdSchedulePage() {
  const { staffId } = useParams()
  const navigate = useNavigate()
  const [days, setDays] = useState(initialDays)
  const [dirty, setDirty] = useState(false)

  if (staffId !== ananya.id) return <StaffNotFound title="OPD Schedule & Tariff" reason="OPD schedule data is connected for Dr. Ananya Rao only in this build." />

  const profilePath = pathFor(ROUTES.staffMember, { staffId })
  const change = (name, update) => {
    setDays((current) => ({ ...current, [name]: update(current[name]) }))
    setDirty(true)
  }
  const toggleDay = (name) => change(name, (state) => ({ on: !state.on, sessions: !state.on && state.sessions.length === 0 ? ['09:00 AM – 01:00 PM|15m · Max 16|Ch. 104'] : state.sessions }))
  const addSession = (name) => change(name, (state) => ({ ...state, sessions: [...state.sessions, NEW_SESSION] }))

  const activeDays = Object.values(days).filter((state) => state.on).length

  return (
    <WorkspacePage>
      <div className="pb-20">
        <PageIntro
          eyebrow={<StatusPill tone={dirty ? 'warning' : 'neutral'}>{dirty ? 'Unsaved schedule changes' : '1 schedule modification pending review'}</StatusPill>}
          title="OPD Schedule & Tariff"
          description="Configure when this doctor provides OPD services and connect the schedule to the clinic's existing tariff configuration."
          actions={
            <>
              <ActionButton icon={ArrowLeft} to={profilePath}>Back to Doctor Profile</ActionButton>
              <ActionButton variant="brand" icon={Save} onClick={() => navigate(profilePath)}>Save Changes</ActionButton>
            </>
          }
        />

        <PersonBanner
          person={ananya}
          badge="Active Roster"
          subtitle={`${ananya.speciality} (IAM: ${ananya.iam})`}
          facts={[
            ['Department', ananya.department],
            ['Active facility anchor', `${ananya.anchor} · 2 Branches`],
            ['Linked tariff context', 'Standard OPD Tariff (Cardiology v24.9)'],
          ]}
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Panel title="01. OPD context & facility lock" action={<span className="text-[11px] text-outline">Scope: Branch specific execution</span>} bodyClassName="grid gap-4 sm:grid-cols-2">
              {[
                ['Doctor record', 'Dr. Ananya Rao · STF-088', true],
                ['Configuring OPD for branch', 'Main Surgical Pavilion (Flagship) - Current Anchor'],
                ['Clinical department', 'Cardiology & Vascular Surgery', true],
                ['Dedicated OPD chamber / suite', 'Chamber Suite 104 · Cardiology OPD Wing'],
              ].map(([label, value, locked]) => (
                <div key={label}>
                  <p className="mb-1 text-[13px] font-semibold text-slate-800">{label}</p>
                  <p className={cn('flex items-center justify-between rounded-md border px-3 py-2 text-[13px]', locked ? 'border-slate-200 bg-surface-lowest' : 'border-slate-300 bg-white')}>
                    {value}
                    {locked && <Lock className="size-3.5 text-outline" aria-hidden="true" />}
                  </p>
                </div>
              ))}
            </Panel>

            <Panel title="02. Weekly OPD schedule matrix" action={<span className="text-[11px] text-on-surface-variant"><span className="text-brand">●</span> Default cadence: 15 mins / token</span>} bodyClassName="p-0">
              <InfoNote className="m-5 mb-0">
                <strong className="text-on-surface">Branch operating hours notice:</strong> Main Surgical Pavilion OPD operates 08:00 AM – 08:00 PM IST. OPD slots configured outside this window require Medical Director override.
              </InfoNote>
              <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {OPD_SCHEDULE.map((day) => (
                  <DayRow key={day.day} day={day} state={days[day.day]} onToggle={() => toggleDay(day.day)} onAddSession={() => addSession(day.day)} />
                ))}
              </ul>
            </Panel>

            <Panel title="03. Associated OPD services & branch tariff" subtitle="Pricing and billing codes are mastered centrally in Services & Pricing." action={<Link to={ROUTES.services} className="text-xs font-semibold text-brand hover:underline">View Full Catalog ↗</Link>} bodyClassName="p-0">
              <Table headings={['Service name', 'Modality', 'Tariff context', 'Branch fee', 'Status', 'Master source']} minWidth={760}>
                {OPD_SERVICES.map((service) => (
                  <Row key={service.id}>
                    <Cell>
                      <p className="font-semibold">{service.name}</p>
                      <p className="text-[11px] text-outline">CODE: {service.code}</p>
                    </Cell>
                    <Cell><span className="rounded bg-surface-high px-1.5 py-0.5 text-[11px]">{service.modality}</span></Cell>
                    <Cell className="text-xs">{service.context}</Cell>
                    <Cell className="font-semibold">{service.price}</Cell>
                    <Cell><StatusPill tone="success">Active</StatusPill></Cell>
                    <Cell><Link to={pathFor(ROUTES.service, { serviceId: 'srv-card-01' })} className="text-xs font-semibold text-brand hover:underline">Manage in Services & Pricing ↗</Link></Cell>
                  </Row>
                ))}
              </Table>
              <InfoNote className="m-5">
                <strong className="text-on-surface">Segregation of duties:</strong> Individual doctor profiles cannot override clinic-wide procedure tariffs. To adjust consult fees or doctor payout splits, authorized administrators must navigate to Configuration → Services & Pricing.
              </InfoNote>
            </Panel>
          </div>

          <div className="flex flex-col gap-5">
            <Panel title="Configuration context" subtitle="Operational boundaries & master sources">
              <dl className="space-y-3 text-xs">
                {[
                  ['Doctor anchor', 'Dr. Ananya Rao (STF-088)'],
                  ['Branch deployment', 'Main Surgical Pavilion'],
                  ['Department scope', 'Cardiology & Vascular'],
                  ['Scheduling model', '15-min recurring slots'],
                  ['Pricing master', 'Central Ledger (v24.9)'],
                  ['Branch hours source', 'Branch Configuration'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-on-surface-variant">{label}</dt>
                    <dd className="text-right font-semibold text-on-surface">{value}</dd>
                  </div>
                ))}
              </dl>
              <InfoNote className="mt-4">Doctor availability configured here governs appointment slot generation. Branch operating hours and holiday calendars are enforced centrally to prevent scheduling outside facility open times.</InfoNote>
            </Panel>

            <Panel title="Weekly capacity summary" action={<StatusPill tone="success">Main Branch</StatusPill>}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Total OPD time</p>
                  <p className="text-xl font-bold text-on-surface">26.5 <span className="text-xs font-normal">hrs/wk</span></p>
                  <p className="text-[11px] text-brand">+2.5 hrs vs standard</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-surface-lowest p-3">
                  <p className="text-[10px] font-semibold tracking-wide text-outline uppercase">Max patient volume</p>
                  <p className="text-xl font-bold text-on-surface">98 <span className="text-xs font-normal">slots</span></p>
                  <p className="text-[11px] text-outline">Calculated at 15m/token</p>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between"><dt className="text-on-surface-variant">Active days</dt><dd className="font-semibold text-on-surface">{activeDays} of 7</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Primary consulting chamber</dt><dd className="font-semibold text-on-surface">Suite 104 (Cath Wing)</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Cross-branch allocation</dt><dd className="font-semibold text-brand">8 hrs @ Kondapur Clinic</dd></div>
              </dl>
            </Panel>

            <Panel title="ABDM & compliance audit" subtitle="Ayushman Bharat Digital Mission">
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between"><dt className="text-on-surface-variant">ABDM slot registry</dt><dd className="font-semibold text-brand">● Live Sync (M1/M2)</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Last revision date</dt><dd className="font-semibold text-on-surface">14 Sep 2026, 11:20 AM</dd></div>
                <div className="flex justify-between"><dt className="text-on-surface-variant">Authorizing sign-off</dt><dd className="font-semibold text-on-surface">Dr. Julian Vance (CMP)</dd></div>
              </dl>
              <InfoNote className="mt-4"><strong className="text-on-surface">Historical safety notice:</strong> Modifying OPD schedule does not cancel or modify already booked future appointments. Existing confirmed patient bookings will retain their original confirmed timestamps.</InfoNote>
            </Panel>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 lg:pl-72">
        <p className="text-xs text-on-surface-variant"><span className="mr-2 text-brand">●</span>Ready to commit changes to <strong className="text-on-surface">Main Pavilion appointment registry</strong></p>
        <div className="flex gap-2">
          <ActionButton onClick={() => navigate(profilePath)}>Discard Unsaved Changes</ActionButton>
          <ActionButton variant="primary" onClick={() => navigate(profilePath)}>Save &amp; Apply OPD Schedule</ActionButton>
        </div>
      </div>
    </WorkspacePage>
  )
}
