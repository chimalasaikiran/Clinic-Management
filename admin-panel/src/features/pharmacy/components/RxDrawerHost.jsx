import { useStock } from '../../inventory/context/useStock'
import DispenseDrawer from '../drawers/DispenseDrawer'
import DispensedRecordDrawer from '../drawers/DispensedRecordDrawer'

// Opens the right drawer for a prescription: verification while it still has medicine to dispense, the record afterwards.
export default function RxDrawerHost({ rxId, onClose }) {
  const { state, run } = useStock()
  const rx = state.rxQueue.find((entry) => entry.id === rxId)
  if (!rx) return null
  if (rx.status === 'Dispensed') return <DispensedRecordDrawer rx={rx} records={state.dispenses} onClose={onClose} />
  return <DispenseDrawer key={`${rx.id}-${rx.status}`} rx={rx} batches={state.batches} onClose={onClose} onDispense={(payload) => run('rx/dispense', payload)} />
}
