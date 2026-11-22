import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { contentApi } from '../contentApi'
import { CONTENT_STATUSES, CONTENT_TONE, TARGETS, targetsLabel } from '../contentView'
import { day } from '../format'
import { monthGrid, shiftMonth } from '../growthLogic'
import { clinicNow, stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function ContentCalendarPage() {
  const { can } = useAuth()
  const context = useLeadContext()
  const filters = useRegisterFilters()
  const today = clinicNow().date
  const thisMonth = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }
  const [cursor, setCursor] = useState(thisMonth)
  const [view, setView] = useState('month')
  const [selectedId, setSelectedId] = useState(null)
  const weeks = monthGrid(cursor.year, cursor.month)
  const query = { from: weeks[0][0], to: weeks.at(-1)[6], q: filters.get('q') || undefined, target: filters.get('target') || undefined, status: filters.get('status') || undefined, branchId: context.branchId || undefined, pageSize: 500 }
  const posts = useApiResource(() => contentApi.posts(query), `content:${JSON.stringify(query)}`)
  const items = (posts.data?.data ?? []).map((post) => ({ ...post, at: stampOf(post.scheduledAt) }))
  const byDate = (iso) => items.filter((item) => item.at?.date === iso)
  const selected = items.find((item) => item.id === selectedId) ?? null
  const state = { search: filters.search }
  const shown = view === 'week' ? [weeks.find((week) => week.includes(today)) ?? weeks[0]] : weeks
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
  const inMonth = items.filter((item) => item.at?.date.startsWith(monthPrefix))
  const manage = can('growth.manage')

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Content Calendar" code="GO-11" title="Content Calendar" description="Plan Facebook and Instagram posts in one place. Every post is approved by a second person before it is published at its time." actions={<><ActionButton to={ROUTES.contentTemplates} state={state}>Templates · GO13</ActionButton>{manage && <ActionButton variant="brand" to={ROUTES.contentNew} state={state}>+ Create Content · GO12</ActionButton>}</>} context={[context.line, `${MONTH_NAMES[cursor.month]} ${cursor.year} · ${view[0].toUpperCase()}${view.slice(1)} view · Asia/Kolkata`]} today={context.today} sample="Live records · Posts publish to the connected Facebook Page and Instagram account after approval">
      <Section title={`${MONTH_NAMES[cursor.month]} ${cursor.year}`} aside="Asia/Kolkata · UTC+05:30" className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ActionButton onClick={() => setCursor(shiftMonth(cursor, -1))}>‹ Previous</ActionButton>
          <ActionButton onClick={() => setCursor(thisMonth)}>Today · {day(today).slice(0, 6)}</ActionButton>
          <ActionButton onClick={() => setCursor(shiftMonth(cursor, 1))}>Next ›</ActionButton>
          <span role="group" aria-label="Calendar view" className="ml-auto flex gap-2">{['month', 'week', 'list'].map((id) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={cn('rounded border px-3.5 py-2 text-[13px] font-medium capitalize', view === id ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-brand')}>{id}{view === id ? ' · selected' : ''}</button>)}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search content" placeholder="Search title, code or caption" /><FilterField label="" value={filters.get('target')} onChange={(value) => filters.change('target', value)} options={[['', 'All networks'], ...Object.entries(TARGETS)]} /><FilterField label="" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], ...Object.entries(CONTENT_STATUSES)]} /></div>
      </Section>

      {!posts.data ? <LoadingState label="Loading content…" error={posts.error} onRetry={posts.reload} /> : view === 'list' ? (
        <Section title={`Content in ${MONTH_NAMES[cursor.month]}`} aside={`${inMonth.length} posts`} className="mb-6">
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Content', 'Date · IST', 'Networks', 'Owner', 'Status'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>{inMonth.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-6 py-3"><button type="button" onClick={() => setSelectedId(item.id)} className="font-semibold text-brand hover:underline">{item.title}</button><br /><span className="text-outline">{item.code}</span></td><td className="px-6 py-3">{day(item.at.date)} · {item.at.time}</td><td className="px-6 py-3">{targetsLabel(item.targets)}</td><td className="px-6 py-3">{item.owner.name}</td><td className="px-6 py-3"><StatusPill tone={CONTENT_TONE[item.status]}>{CONTENT_STATUSES[item.status]}</StatusPill></td></tr>)}</tbody></table>
            {inMonth.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">No posts this month match these filters.</p>}</div>
        </Section>
      ) : (
        <div className="mb-3 overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="grid grid-cols-7 bg-surface-low text-xs font-medium">{WEEKDAYS.map((weekday) => <p key={weekday} className="px-3 py-3">{weekday}</p>)}</div>
          {shown.map((week) => (
            <div key={week[0]} className="grid grid-cols-7 border-t border-slate-200">
              {week.map((iso) => {
                const cards = byDate(iso)
                const outside = Number(iso.slice(5, 7)) - 1 !== cursor.month
                return (
                  <div key={iso} className={cn('min-h-[120px] border-r border-slate-200 p-2 text-xs last:border-r-0', outside && 'bg-surface-lowest text-outline', iso === today && 'bg-teal-50')}>
                    <p className="flex justify-between font-medium"><span>{Number(iso.slice(8))}{outside || iso.slice(8) === '01' ? ` ${day(iso).slice(3, 6)}` : ''}</span>{iso === today && <span className="text-[10px] font-semibold text-brand">Today</span>}</p>
                    {cards.length === 0 ? <p className="mt-1 text-[10px] text-outline">No plan</p> : cards.map((item) => (
                      <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-label={`${item.title} ${CONTENT_STATUSES[item.status]}`} className={cn('mt-1.5 block w-full rounded border bg-white p-2 text-left', selectedId === item.id ? 'border-brand' : 'border-slate-200')}>
                        <span className="block text-[10px] text-outline">{item.at.time} · {item.code}</span><StatusPill tone={CONTENT_TONE[item.status]} className="my-1">{CONTENT_STATUSES[item.status]}</StatusPill><span className="block text-[13px] font-semibold leading-4">{item.title}</span><span className="text-[10px] text-outline">{targetsLabel(item.targets)}</span>
                      </button>))}
                  </div>
                )
              })}
            </div>))}
        </div>
      )}

      <p className="mb-6 flex flex-wrap items-center gap-2 text-xs"><strong>Status legend</strong>{Object.entries(CONTENT_STATUSES).map(([status, label]) => <StatusPill key={status} tone={CONTENT_TONE[status]}>{label}</StatusPill>)}</p>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {selected ? (
          <Section title={`Selected · ${selected.code}`} aside={CONTENT_STATUSES[selected.status]}>
            <Link to={pathFor(ROUTES.contentSchedule, { contentId: selected.id })} state={state} className="text-[13px] font-semibold text-brand hover:underline">{selected.title} ↗</Link>
            <p className="mt-3 text-xs">{selected.owner.name} · {selected.branch.name} · {selected.category} · {targetsLabel(selected.targets)}</p><p className="mt-2 text-xs">{day(selected.at.date)} · {selected.at.time} Asia/Kolkata</p>
            {selected.reviewNote && selected.status === 'draft' && <Banner tone="warning" title="Sent back by the reviewer" className="mt-4">{selected.reviewNote}</Banner>}
            <div className="mt-4 flex flex-wrap gap-3">{manage && selected.status === 'draft' && <ActionButton to={pathFor(ROUTES.contentEdit, { contentId: selected.id })} state={state}>Edit draft · GO12</ActionButton>}<ActionButton to={pathFor(ROUTES.contentSchedule, { contentId: selected.id })} state={state}>Review & publishing · GO14</ActionButton></div>
          </Section>
        ) : <Section title="Select a post" aside="Calendar"><p className="text-xs text-on-surface-variant">Choose a post on the calendar to see its status and open it.</p></Section>}
        <Section title="How a post goes out" aside="Two people">
          <ol className="list-decimal space-y-2 pl-4 text-xs leading-5 text-on-surface-variant"><li>Someone with “Run campaigns” drafts it and submits it with a time.</li><li>A different person approves it, or sends it back with a reason.</li><li>At its time, ClinicOS publishes it to each network and records the result.</li></ol>
          <div className="mt-3 flex gap-3"><ActionButton onClick={filters.reset}>Reset filters</ActionButton>{manage && <ActionButton to={ROUTES.contentNew} state={state}>Create Content</ActionButton>}</div>
        </Section>
      </div>
      <GrowthFooter code="GO-11" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
