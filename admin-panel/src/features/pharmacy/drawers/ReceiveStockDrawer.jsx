import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import { Check, OptionSelect } from '../../patients/components/parts'
import { locationName } from '../../inventory/constants'
import { itemById } from '../../inventory/data/items'
import { formatDate, qty, shortDateTime } from '../../inventory/format'

// Receiving at the dispensary: checks a dispatched transfer against what physically arrived, then posts it.
export default function ReceiveStockDrawer({ transfers, onClose, onReceive }) {
  const [transferId, setTransferId] = useState(transfers[0]?.id ?? '')
  const transfer = transfers.find((entry) => entry.id === transferId)
  const [received, setReceived] = useState({})
  const [temperature, setTemperature] = useState('')
  const [verified, setVerified] = useState(false)
  const [errors, setErrors] = useState({})
  const lines = transfer?.lines ?? []
  const cold = lines.some((line) => /cold/i.test(itemById(line.itemId).storage ?? ''))
  const amount = (index) => received[index] ?? String(lines[index].qty)

  const post = () => {
    const found = {}
    lines.forEach((line, index) => {
      const value = Number(amount(index))
      if (!Number.isInteger(value) || value < 0 || value > line.qty) found[`line${index}`] = `Enter a whole number from 0 to ${line.qty}.`
    })
    if (cold && !/^-?\d+(\.\d)?$/.test(temperature.trim())) found.temperature = 'Record the arrival temperature of the cold-chain items.'
    if (!verified) found.verified = 'Confirm that the quantities and batches were physically verified.'
    setErrors(found)
    if (Object.keys(found).length) return
    onReceive(transfer.id, Object.fromEntries(lines.map((_, index) => [index, Number(amount(index))])))
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Pharmacy dispensary · Inventory intake"
      title="Receive Stock (GRN)"
      description="Check a dispatched transfer against what arrived and post the accepted quantities to the dispensary."
      width="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ActionButton onClick={onClose}>Cancel (Esc)</ActionButton>
          <ActionButton variant="primary" onClick={post} disabled={!transfer}>Post receipt</ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        {!transfer ? (
          <InfoNote>No transfers are in transit to this pharmacy. Stock Central Stores has dispatched will appear here until it is received.</InfoNote>
        ) : (
          <>
            <OptionSelect label="Dispatched transfer" value={transferId} onChange={(event) => { setTransferId(event.target.value); setReceived({}) }} options={transfers.map((entry) => ({ value: entry.id, label: `${entry.id} · ${locationName(entry.from)} → ${locationName(entry.to)}` }))} />
            <p className="text-xs text-on-surface-variant">Dispatched {shortDateTime(transfer.dispatched, transfer.dispatchedTime)} · issue {transfer.issueId}{transfer.requestId ? ` · request ${transfer.requestId}` : ''}</p>

            <ul className="flex flex-col gap-3">
              {lines.map((line, index) => {
                const item = itemById(line.itemId)
                return (
                  <li key={`${line.batchId}-${index}`} className="grid items-end gap-3 rounded-md border border-slate-200 p-4 sm:grid-cols-[2fr_1fr_1fr]">
                    <div><p className="font-semibold">{item.name}</p><p className="text-[11px] text-outline">{item.id} · Batch <span className="font-mono">{line.batchNo}</span> · exp {formatDate(line.expiry)}</p></div>
                    <div className="text-xs"><p className="text-outline">Dispatched</p><p className="font-semibold">{qty(line.qty)} {item.unitPlural}</p></div>
                    <TextInput label="Received now" inputMode="numeric" aria-label={`Received quantity for ${item.name}`} value={amount(index)} onChange={(event) => setReceived((current) => ({ ...current, [index]: event.target.value }))} error={errors[`line${index}`]} />
                  </li>
                )
              })}
            </ul>

            {cold && <TextInput label="Arrival temperature (°C)" required value={temperature} onChange={(event) => setTemperature(event.target.value)} error={errors.temperature} hint="Acceptable range 2.0°C – 8.0°C" />}
            <InfoNote tone="neutral">A shortage stays on the transfer as a traceable exception. Only the received quantity is added to dispensary stock, and it becomes available for dispensing as soon as it is posted.</InfoNote>
            <div>
              <Check checked={verified} onChange={(event) => setVerified(event.target.checked)} label="I have physically verified the quantities, batch numbers and expiry dates." />
              {errors.verified && <p role="alert" className="mt-1 text-xs text-rose-600">{errors.verified}</p>}
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
