import { useState } from 'react'
import { BadgeCheck, Landmark, Pencil, Plus, Save, Scale, Trash2, Users } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Breadcrumb from '../../../components/workspace/Breadcrumb'
import { SearchBox, Toggle } from '../../../components/workspace/controls'
import { Cell, Table, TableFooter } from '../../../components/workspace/DataTable'
import Drawer from '../../../components/workspace/Drawer'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import { Banner } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'
import { EmployeeCell, PayrollTabs } from '../components/PayrollKit'
import { EMPLOYMENT, PAY_MODELS } from '../constants'
import { usePayroll } from '../context/usePayroll'
import { rupees } from '../format'
import { branchName, validateProfile, validateSettings } from '../payrollLogic'

const EMPLOYMENT_OPTIONS = Object.entries(EMPLOYMENT).map(([value, label]) => ({ value, label }))
const MODEL_OPTIONS = Object.entries(PAY_MODELS).map(([value, model]) => ({ value, label: model.label }))

function SwitchRow({ label, detail, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[13px] font-semibold text-on-surface">{label}</p>
        <p className="text-xs text-on-surface-variant">{detail}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

// The statutory deduction rules every payslip is worked out with.
function RulesForm({ settings, onSave }) {
  const [values, setValues] = useState(() => ({ ...settings, ptSlabs: settings.ptSlabs.map((slab) => ({ ...slab })) }))
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const errors = submitted ? validateSettings(values) : {}
  const set = (key) => (value) => {
    setValues((current) => ({ ...current, [key]: value }))
    setSaved(false)
  }
  const field = (key) => (event) => set(key)(event.target.value)
  const setSlab = (index, key, value) => set('ptSlabs')(values.ptSlabs.map((slab, position) => (position === index ? { ...slab, [key]: value } : slab)))

  const save = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateSettings(values)).length) return
    setBusy(true)
    const numbers = ['epfRate', 'epfCap', 'esicRate', 'esicCeiling', 'tdsRate', 'payDay']
    const result = await onSave({
      ...Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'version')),
      ...Object.fromEntries(numbers.map((key) => [key, Number(values[key])])),
      ptState: values.ptState.trim(),
      ptSlabs: values.ptSlabs.map((slab) => ({ above: Number(slab.above), amount: Number(slab.amount) })),
    })
    setBusy(false)
    if (!result.error) setSaved(true)
  }

  return (
    <form onSubmit={save} noValidate>
      <Panel title="Statutory deductions" icon={Scale} subtitle="Applied to every payslip of the next calculation. Changing them withdraws an approved run." bodyClassName="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
          <SwitchRow label="EPF" detail="Employees' provident fund, for full-time and part-time staff" checked={values.epfEnabled} onChange={set('epfEnabled')} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="EPF rate (%)" name="epfRate" type="number" min="0" step="0.01" value={values.epfRate} onChange={field('epfRate')} error={errors.epfRate} />
            <TextInput label="Monthly EPF cap (₹)" name="epfCap" type="number" min="0" hint="0 for no cap" value={values.epfCap} onChange={field('epfCap')} error={errors.epfCap} />
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
          <SwitchRow label="ESIC" detail="Employees' state insurance, up to the wage ceiling" checked={values.esicEnabled} onChange={set('esicEnabled')} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="ESIC rate (%)" name="esicRate" type="number" min="0" step="0.01" value={values.esicRate} onChange={field('esicRate')} error={errors.esicRate} />
            <TextInput label="ESIC wage ceiling (₹)" name="esicCeiling" type="number" min="0" value={values.esicCeiling} onChange={field('esicCeiling')} error={errors.esicCeiling} />
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
          <SwitchRow label="Professional tax" detail="Monthly slab of the state you pay it in" checked={values.ptEnabled} onChange={set('ptEnabled')} />
          <TextInput label="State" name="ptState" value={values.ptState} onChange={field('ptState')} error={errors.ptState} className="sm:w-64" />
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-slate-800">Slabs</p>
            <ul className="flex flex-col gap-2">
              {values.ptSlabs.map((slab, index) => (
                <li key={index} className="flex flex-wrap items-end gap-2">
                  <TextInput label={`Gross above (₹), slab ${index + 1}`} name={`above-${index}`} type="number" min="0" value={slab.above} onChange={(event) => setSlab(index, 'above', event.target.value)} className="w-44" />
                  <TextInput label={`Tax (₹), slab ${index + 1}`} name={`amount-${index}`} type="number" min="0" value={slab.amount} onChange={(event) => setSlab(index, 'amount', event.target.value)} className="w-32" />
                  <ActionButton size="sm" icon={Trash2} aria-label={`Remove slab ${index + 1}`} onClick={() => set('ptSlabs')(values.ptSlabs.filter((_, position) => position !== index))} />
                </li>
              ))}
            </ul>
            {errors.ptSlabs && <p role="alert" className="mt-1.5 text-xs text-rose-600">{errors.ptSlabs}</p>}
            <ActionButton size="sm" icon={Plus} className="mt-2" onClick={() => set('ptSlabs')([...values.ptSlabs, { above: '', amount: '' }])} disabled={values.ptSlabs.length >= 10}>
              Add slab
            </ActionButton>
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
          <SwitchRow label="TDS on professional fees" detail="Sec 194J, withheld from consultants and contract locums instead of EPF, ESIC and PT" checked={values.tdsEnabled} onChange={set('tdsEnabled')} />
          <TextInput label="TDS rate (%)" name="tdsRate" type="number" min="0" step="0.01" value={values.tdsRate} onChange={field('tdsRate')} error={errors.tdsRate} className="sm:w-64" />
        </section>
        <TextInput label="Pay day of the following month" name="payDay" type="number" min="1" max="28" value={values.payDay} onChange={field('payDay')} error={errors.payDay} className="sm:w-64" />
        <div className="flex flex-wrap items-center gap-3">
          <ActionButton variant="primary" type="submit" icon={Save} disabled={busy}>
            Save rules
          </ActionButton>
          {saved && <span role="status" className="text-xs font-semibold text-brand">Rules saved.</span>}
          {settings.version === null && !saved && <span className="text-xs text-outline">Showing the defaults; nothing is saved yet.</span>}
        </div>
      </Panel>
    </form>
  )
}

// A staff member's pay profile. Only the bank name, IFSC and last four digits of the account are kept.
function ProfileForm({ employee, onSave, onClose }) {
  const profile = employee.profile
  const [values, setValues] = useState({
    employment: profile?.employment ?? 'full_time', model: profile?.model ?? 'monthly', rate: profile?.rate ?? '', bankName: profile?.bankName ?? '',
    ifsc: profile?.ifsc ?? '', accountLast4: profile?.accountLast4 ?? '', active: profile?.active ?? true,
  })
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const errors = submitted ? validateProfile(values) : {}
  const change = (event) => setValues((current) => ({ ...current, [event.target.name]: event.target.value }))
  const bankChanged = profile && ['bankName', 'ifsc', 'accountLast4'].some((key) => String(values[key]).trim().toUpperCase() !== String(profile[key]).toUpperCase())

  const save = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateProfile(values)).length) return
    setBusy(true)
    const result = await onSave(values)
    setBusy(false)
    if (!result.error) onClose()
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4 p-5">
      <SelectInput label="Employment type" name="employment" required options={EMPLOYMENT_OPTIONS} value={values.employment} onChange={change} error={errors.employment} />
      <SelectInput label="Pay model" name="model" required options={MODEL_OPTIONS} value={values.model} onChange={change} error={errors.model} />
      <TextInput label={`Rate (₹ per ${PAY_MODELS[values.model].unit === 'mo' ? 'month' : PAY_MODELS[values.model].unit})`} name="rate" type="number" min="0" required value={values.rate} onChange={change} error={errors.rate} />
      <p className="text-xs text-on-surface-variant">
        {values.model === 'monthly' ? 'Paid for the days not marked absent in attendance.' : values.model === 'visit' ? 'Paid per completed appointment of the linked login.' : `The ${values.model === 'shift' ? 'shifts' : 'hours'} worked are entered in each run.`}
      </p>
      <TextInput label="Bank name" name="bankName" required value={values.bankName} onChange={change} error={errors.bankName} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="IFSC" name="ifsc" required value={values.ifsc} onChange={change} error={errors.ifsc} placeholder="HDFC0001234" />
        <TextInput label="Account, last 4 digits" name="accountLast4" required inputMode="numeric" maxLength={4} value={values.accountLast4} onChange={change} error={errors.accountLast4} />
      </div>
      <Banner>The full account number is never stored. Transfers are made from your bank, and their reference is recorded against each payslip.</Banner>
      {bankChanged && profile.bankVerified && <Banner tone="warning" title="Bank details changed">They will need verifying again before this person can be paid.</Banner>}
      {profile && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold">Active pay profile</p>
          <Toggle checked={values.active} onChange={(active) => setValues((current) => ({ ...current, active }))} label="Active pay profile" />
        </div>
      )}
      <ActionButton variant="primary" type="submit" icon={Save} disabled={busy}>
        {profile ? 'Save pay profile' : 'Create pay profile'}
      </ActionButton>
    </form>
  )
}

export default function PayrollSetupPage() {
  const { settings, staff, saveSettings, saveProfile, verifyBank } = usePayroll()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const search = query.trim().toLowerCase()
  const rows = staff.filter((employee) => !search || `${employee.name} ${employee.id} ${employee.department}`.toLowerCase().includes(search))
  const configured = staff.filter((employee) => employee.hasProfile).length
  const editingEmployee = staff.find((employee) => employee.id === editing)

  return (
    <WorkspacePage>
      <Breadcrumb items={[{ label: 'Payroll & salary', to: ROUTES.payroll }, { label: 'Pay profiles & rules' }]} />
      <PageIntro title="Pay profiles & rules" description="How each person is paid, and the statutory deductions applied to every payslip." />
      <PayrollTabs />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="Staff pay profiles" icon={Users} subtitle={`${configured} of ${staff.length} staff have an active pay profile`} bodyClassName="p-0">
          <div className="border-b border-slate-100 p-4">
            <SearchBox value={query} onChange={setQuery} label="Search staff" placeholder="Search name, staff ID or department" />
          </div>
          <Table headings={['Staff member', 'Branch', 'Employment & pay', 'Bank', 'Action']} minWidth={760} empty={rows.length ? null : 'No staff match your search.'}>
            {rows.map((employee) => (
              <tr key={employee.id} className="border-b border-slate-100 align-top last:border-0">
                <Cell><EmployeeCell employee={employee} /></Cell>
                <Cell>{branchName(employee.branchId)}</Cell>
                <Cell>
                  {employee.profile ? (
                    <>
                      <p>{employee.employment}{employee.profile.active ? '' : ' · inactive'}</p>
                      <p className="text-[11px] text-outline">{PAY_MODELS[employee.model].label} · {rupees(employee.rate)}/{PAY_MODELS[employee.model].unit}</p>
                    </>
                  ) : <StatusPill tone="warning">No pay profile</StatusPill>}
                </Cell>
                <Cell>
                  {employee.profile ? (
                    <>
                      <p className="text-xs">{employee.bank}</p>
                      {employee.bankVerified ? <StatusPill tone="success">Verified</StatusPill> : (
                        <ActionButton size="sm" icon={BadgeCheck} onClick={() => verifyBank(employee.id)} className="mt-1">Verify bank details</ActionButton>
                      )}
                    </>
                  ) : '—'}
                </Cell>
                <Cell>
                  <ActionButton size="sm" icon={employee.profile ? Pencil : Plus} onClick={() => setEditing(employee.id)} aria-label={`${employee.profile ? 'Edit' : 'Add'} pay profile for ${employee.name}`}>
                    {employee.profile ? 'Edit' : 'Add profile'}
                  </ActionButton>
                </Cell>
              </tr>
            ))}
          </Table>
          <TableFooter summary={`Showing ${rows.length} of ${staff.length} staff · add people in the Staff directory`} />
        </Panel>

        <RulesForm settings={settings} onSave={saveSettings} />
      </div>

      {editingEmployee && (
        <Drawer open onClose={() => setEditing(null)} eyebrow={editingEmployee.profile ? 'Edit pay profile' : 'New pay profile'} title={editingEmployee.name} description={`${editingEmployee.id} · ${editingEmployee.title}`}>
          <div className="px-5 pt-5"><p className="flex items-center gap-2 text-xs text-on-surface-variant"><Landmark className="size-3.5" aria-hidden="true" /> {branchName(editingEmployee.branchId)}</p></div>
          <ProfileForm employee={editingEmployee} onSave={(values) => saveProfile(editingEmployee.id, values)} onClose={() => setEditing(null)} />
        </Drawer>
      )}
    </WorkspacePage>
  )
}
