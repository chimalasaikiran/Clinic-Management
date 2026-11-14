import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'
import { cn } from '../../../lib/cn'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { CONTENT_CHANNELS, CONTENT_STATUSES, GROWTH_TODAY } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'
import { contentRows, monthGrid, shiftMonth } from '../growthLogic'

const TONE = { Draft: 'neutral', 'Needs review': 'warning', Scheduled: 'success', Published: 'success', Failed: 'danger' }
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const TODAY = { year: Number(GROWTH_TODAY.slice(0, 4)), month: Number(GROWTH_TODAY.slice(5, 7)) - 1 }

export default function ContentCalendarPage() {
  const { data } = useGrowth()
  const filters = useRegisterFilters()
  const [cursor, setCursor] = useState(TODAY)
  const [view, setView] = useState('month')
  const [selectedId, setSelectedId] = useState('CNT3101')
  const items = contentRows(data.content, { query: filters.get('q'), channel: filters.get('channel'), status: filters.get('status') })
  const weeks = monthGrid(cursor.year, cursor.month)
  const byDate = (iso) => items.filter((item) => item.date === iso)
  const selected = data.content.find((item) => item.id === selectedId) ?? data.content[0]
  const state = { search: filters.search }
  const shown = view === 'week' ? [weeks.find((week) => week.includes(GROWTH_TODAY)) ?? weeks[0]] : weeks
  const inMonth = items.filter((item) => item.date.startsWith(`${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`))

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Content Calendar" code="GO-11" title="Content Calendar" description="Plan clinic content in one place. Draft intent is separate from acknowledged scheduling and confirmed publishing." actions={<><ActionButton to={ROUTES.contentTemplates} state={state}>Templates · GO13</ActionButton><ActionButton variant="brand" to={ROUTES.contentNew} state={state}>+ Create Content · GO12</ActionButton></>} context={[`Calendar origin · ${MONTH_NAMES[cursor.month]} ${cursor.year} · ${view[0].toUpperCase()}${view.slice(1)} view · Jubilee Hills Clinic`, 'Timezone: Asia/Kolkata (UTC+05:30) · Date, view and filters are kept on return']}>
      <Section title={`${MONTH_NAMES[cursor.month]} ${cursor.year}`} aside="Asia/Kolkata · UTC+05:30" className="mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ActionButton onClick={() => setCursor(shiftMonth(cursor, -1))}>‹ Previous</ActionButton>
          <ActionButton onClick={() => setCursor(TODAY)}>Today · {day(GROWTH_TODAY).slice(0, 6)}</ActionButton>
          <ActionButton onClick={() => setCursor(shiftMonth(cursor, 1))}>Next ›</ActionButton>
          <span role="group" aria-label="Calendar view" className="ml-auto flex gap-2">{['month', 'week', 'list'].map((id) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={cn('rounded border px-3.5 py-2 text-[13px] font-medium capitalize', view === id ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-brand')}>{id}{view === id ? ' · selected' : ''}</button>)}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3"><SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search content" placeholder="Search title, ID or owner" /><FilterField label="" value={filters.get('channel')} onChange={(value) => filters.change('channel', value)} options={[['', 'All channels'], ...CONTENT_CHANNELS]} /><FilterField label="" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], ...CONTENT_STATUSES]} /></div>
      </Section>

      <Banner tone="warning" title="State examples · sample provider responses; no live delivery" className="mb-6">Cards marked FIXTURE demonstrate Needs review, Scheduled, Published and Failed only. They are not current delivery data or evidence of connected providers. Dates without a card mean no plan, not a successful empty query.</Banner>

      {view === 'list' ? (
        <Section title={`Content in ${MONTH_NAMES[cursor.month]}`} aside={`${inMonth.length} records`} className="mb-6">
          <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Content', 'Date · IST', 'Channels', 'Owner', 'Status'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>{inMonth.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-6 py-3"><button type="button" onClick={() => setSelectedId(item.id)} className="font-semibold text-brand hover:underline">{item.title}</button><br /><span className="text-outline">{item.id}</span></td><td className="px-6 py-3">{day(item.date)} · {item.time}</td><td className="px-6 py-3">{item.channels}</td><td className="px-6 py-3">{item.owner}</td><td className="px-6 py-3"><StatusPill tone={TONE[item.status]}>{item.status}</StatusPill></td></tr>)}</tbody></table>
            {inMonth.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">No content records match these filters.</p>}</div>
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
                  <div key={iso} className={cn('min-h-[120px] border-r border-slate-200 p-2 text-xs last:border-r-0', outside && 'bg-surface-lowest text-outline', iso === GROWTH_TODAY && 'bg-teal-50')}>
                    <p className="flex justify-between font-medium"><span>{Number(iso.slice(8))}{outside || iso.slice(8) === '01' ? ` ${day(iso).slice(3, 6)}` : ''}</span>{iso === GROWTH_TODAY && <span className="text-[10px] font-semibold text-brand">Today</span>}</p>
                    {cards.length === 0 ? <p className="mt-1 text-[10px] text-outline">No plan</p> : cards.map((item) => (
                      <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} aria-label={`${item.title} ${item.status}`} className={cn('mt-1.5 block w-full rounded border bg-white p-2 text-left', selectedId === item.id ? 'border-brand' : 'border-slate-200')}>
                        <span className="block text-[10px] text-outline">{item.time}{item.id === 'CNT3101' ? ` · ${item.id}` : ''}</span><StatusPill tone={TONE[item.status]} className="my-1">{item.status}</StatusPill><span className="block text-[13px] font-semibold leading-4">{item.title}</span><span className="text-[10px] text-outline">{item.channels}</span>
                      </button>))}
                  </div>
                )
              })}
            </div>))}
        </div>
      )}

      <p className="mb-6 flex flex-wrap items-center gap-2 text-xs"><strong>Status legend</strong>{CONTENT_STATUSES.map((status) => <StatusPill key={status} tone={TONE[status]}>{status}</StatusPill>)}</p>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {selected && (
          <Section title={`Selected · ${selected.id}`} aside={`${selected.status}${selected.status === 'Draft' ? ', not scheduled' : ''}`}>
            <Link to={pathFor(ROUTES.contentEdit, { contentId: selected.id })} state={state} className="text-[13px] font-semibold text-brand hover:underline">{selected.title} ↗</Link>
            <p className="mt-3 text-xs">{selected.owner} · {selected.branch} · {selected.category} · {selected.channels}</p><p className="mt-2 text-xs">{day(selected.date)} · {selected.time} Asia/Kolkata · Intent only, not a booking</p>
            {selected.status === 'Draft' && <Banner tone="warning" title="Clinical approval pending · Connection/authorization not verified" className="mt-4">Open the editor to change the retained draft; preview or schedule review continues in GO14. Public organic post: no recipient audience evaluation applies.</Banner>}
            <div className="mt-4 flex flex-wrap gap-3"><ActionButton to={pathFor(ROUTES.contentEdit, { contentId: selected.id })} state={state}>Edit draft · GO12</ActionButton><ActionButton to={ROUTES.contentTemplates} state={state}>Create from template · GO13</ActionButton></div>
          </Section>
        )}
        <Section title="Response-state examples" aside="Not current results">
          <p className="text-[13px] font-semibold">Known empty-day example</p><p className="mt-2 text-xs leading-5">“No content records match these filters” appears only after a successful authorized content query.</p>
          <div className="mt-3 flex gap-3"><ActionButton onClick={filters.reset}>Reset filters</ActionButton><ActionButton to={ROUTES.contentNew} state={state}>Create Content</ActionButton></div>
          <p className="mt-3 text-[11px] text-outline">Failed fixtures show a provider rejection, not a sync failure. Scheduled and Published require reference and timestamp evidence from a provider.</p>
        </Section>
      </div>
      <GrowthFooter code="GO-11" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
