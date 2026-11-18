import { useState } from 'react'
import { CalendarDays, Play } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import Panel from '../../../components/workspace/Panel'
import { usePayroll } from '../context/usePayroll'
import { monthLabel, nextRunMonth } from '../payrollLogic'

// Starts the payroll run for a month. Every person with an active pay profile joins it for review.
export default function StartRunPanel() {
  const { history, today, employees, startRun } = usePayroll()
  const [month, setMonth] = useState(() => nextRunMonth(history, today))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('Choose the month to pay.')
    if (month > today.slice(0, 7)) return setError('A payroll run can only be started for the current month or an earlier one.')
    setBusy(true)
    const result = await startRun(month)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <Panel title="Start a payroll run" icon={CalendarDays} subtitle={history[0] ? `Last processed run: ${history[0].label}` : 'No payroll has been processed yet'} bodyClassName="flex flex-col gap-4">
      <p className="text-[13px] text-on-surface-variant">
        Paid days come from attendance, per-visit pay from completed appointments, and shifts or hours are entered in the run. {employees.length} staff have an active pay profile.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <TextInput label="Payroll month" name="month" type="month" required value={month} max={today.slice(0, 7)} onChange={(event) => { setMonth(event.target.value); setError('') }} error={error} className="w-56" />
        <ActionButton variant="primary" icon={Play} onClick={start} disabled={busy || !employees.length}>
          Start {/^\d{4}-\d{2}$/.test(month) ? monthLabel(month) : ''} run
        </ActionButton>
      </div>
      {!employees.length && <p className="text-xs text-amber-800">Add a pay profile for at least one staff member under Pay profiles & rules first.</p>}
    </Panel>
  )
}
