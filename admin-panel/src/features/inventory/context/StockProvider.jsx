import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import LoadingState from '../../patients/components/LoadingState'
import { toStockState } from '../adapters'
import { inventoryApi } from '../api'
import { dispensaryId, setLocations } from '../constants'
import { setItems } from '../data/items'
import { StockContext } from './stockContext'

const DISPENSARY_KEY = 'clinicos.dispensary'
const storedDispensary = () => {
  try {
    return localStorage.getItem(DISPENSARY_KEY)
  } catch {
    return null
  }
}

const EMPTY = { batches: [], movements: [], requests: [], transfers: [], orders: [], receipts: [], adjustments: [], suppliers: [], rxQueue: [], dispenses: [], cases: [] }

// Loads stock, purchasing and pharmacy records from the API and runs every operation through it, reloading
// afterwards so a step in one screen (approve a request, dispatch, receive, dispense) shows up in the next.
// `run(type, payload)` keeps the operation names the screens use and resolves to { id } or { error }.
export default function StockProvider({ children }) {
  const [view, setView] = useState({ status: 'loading', data: null, error: null })
  const [dispensary, setDispensary] = useState(storedDispensary)
  // The last operation the server refused, shown above the screen until it is dismissed or the next one succeeds.
  const [failure, setFailure] = useState(null)
  const latest = useRef(0)
  const data = useRef(null)

  const settle = useCallback((request, promise) => promise.then(
    (response) => {
      if (request !== latest.current) return
      const mapped = toStockState(response)
      data.current = mapped
      setView({ status: 'ready', data: mapped, error: null })
    },
    (error) => request === latest.current && setView((current) => ({ ...current, status: current.data ? 'ready' : 'error', error })),
  ), [])

  const load = useCallback(() => settle(++latest.current, inventoryApi.state()), [settle])
  useEffect(() => {
    settle(++latest.current, inventoryApi.state())
  }, [settle])

  // The registries other modules read (items, locations, the pharmacy in use) follow the loaded state.
  if (view.data) {
    setItems(view.data.items)
    setLocations(view.data.locations, dispensary)
  }
  const activeDispensary = view.data ? dispensaryId() : null

  const run = useCallback(async (type, payload = {}) => {
    const stock = data.current
    const uuidOf = (list, id) => list.find((entry) => entry.id === id)?.uuid
    const item = (code) => uuidOf(stock.items, code)
    const location = (code) => uuidOf(stock.locations, code)
    const find = (collection, id) => stock.state[collection].find((entry) => entry.id === id)
    const byItem = (record) => Object.fromEntries(Object.entries(record).map(([code, qty]) => [item(code), Number(qty) || 0]).filter(([id, qty]) => id && qty))
    const call = OPERATIONS[type]
    if (!call) throw new Error(`Unknown stock action: ${type}`)
    try {
      const result = await call(payload, { stock, item, location, find, byItem })
      setFailure(null)
      await load()
      return { ...result, id: result?.reference ?? payload.id ?? result?.id }
    } catch (error) {
      setFailure(error.message)
      return { error: error.message, details: error.details }
    }
  }, [load])

  const chooseDispensary = useCallback((id) => {
    setDispensary(id)
    try {
      localStorage.setItem(DISPENSARY_KEY, id)
    } catch {
      // The choice simply is not remembered on this device.
    }
  }, [])

  const value = useMemo(() => ({
    state: view.data?.state ?? EMPTY,
    items: view.data?.items ?? [],
    locations: view.data?.locations ?? [],
    branches: view.data?.branches ?? [],
    members: view.data?.members ?? [],
    dispensary: activeDispensary,
    chooseDispensary,
    run,
    reload: load,
  }), [view.data, chooseDispensary, run, load, activeDispensary])

  if (view.status !== 'ready') {
    return <WorkspacePage><LoadingState label="Loading stock and pharmacy records…" error={view.status === 'error' ? view.error : null} onRetry={load} /></WorkspacePage>
  }
  return (
    <StockContext.Provider value={value}>
      {failure && (
        <div role="alert" className="mx-auto mt-4 flex max-w-7xl items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          <span><strong className="font-semibold">Not saved.</strong> {failure}</span>
          <button type="button" onClick={() => setFailure(null)} className="font-semibold hover:underline">Dismiss</button>
        </div>
      )}
      {children ?? <Outlet />}
    </StockContext.Provider>
  )
}

// Each screen operation as the API call(s) it stands for.
const OPERATIONS = {
  'request/save': ({ id, submit, pharmacy, priority, required, reason, notes, lines }, { location, item, find }) => {
    const body = { submit, locationId: location(pharmacy), priority, requiredBy: required || null, reason, notes: notes ?? '', lines: lines.map((line) => ({ itemId: item(line.itemId), requested: Number(line.requested) })) }
    const current = id && find('requests', id)
    return current ? inventoryApi.updateRequest(current.uuid, { ...body, version: current.version }) : inventoryApi.createRequest(body)
  },
  'request/review': ({ id, decision, approveNow = {}, reason }, { find, byItem }) => {
    const request = find('requests', id)
    return inventoryApi.reviewRequest(request.uuid, { decision: decision === 'Reject request' ? 'reject' : 'approve', approve: byItem(approveNow), reason: reason ?? '', version: request.version })
  },
  'request/cancel': ({ id, reason }, { find }) => {
    const request = find('requests', id)
    return inventoryApi.cancelRequest(request.uuid, { reason: reason ?? '', version: request.version })
  },
  'transfer/save': ({ id, from, to, lines, reason, notes, planned, mode, requestId }, { find, location }) => {
    if (requestId) return inventoryApi.transferForRequest(find('requests', requestId).uuid)
    const body = { mode, fromLocationId: location(from), toLocationId: location(to), lines: lines.filter((line) => line.qty > 0).map((line) => ({ batchId: line.batchId, qty: Number(line.qty) })), reason, notes: notes ?? '', plannedOn: planned || null }
    const current = id && find('transfers', id)
    return current ? inventoryApi.updateTransfer(current.uuid, { ...body, version: current.version }) : inventoryApi.createTransfer(body)
  },
  'transfer/dispatch': ({ id }, { find }) => {
    const transfer = find('transfers', id)
    return inventoryApi.dispatchTransfer(transfer.uuid, transfer.version)
  },
  'transfer/receive': ({ id, received = {} }, { find }) => {
    const transfer = find('transfers', id)
    return inventoryApi.receiveTransfer(transfer.uuid, { received: transfer.lines.map((line, index) => Math.max(0, Math.min(Number(received[index] ?? line.qty), line.qty))), version: transfer.version })
  },
  'transfer/cancel': ({ id }, { find }) => {
    const transfer = find('transfers', id)
    return inventoryApi.cancelTransfer(transfer.uuid, transfer.version)
  },
  'order/create': ({ supplierId, store, expected, reference, terms, notes, draft, lines }, { location, item }) =>
    inventoryApi.createOrder({ supplierId, storeId: location(store), expectedOn: expected || null, supplierRef: reference ?? '', terms: terms ?? '', notes: notes ?? '', draft: Boolean(draft), lines: lines.map((line) => ({ itemId: item(line.itemId), ordered: Number(line.ordered), rate: Number(line.rate) || 0 })) }),
  'receipt/save': ({ id, mode, supplierId, orderId, store, challan, invoice, bay, verified, lines, discrepancies, attachments }, { location, item, find }) => {
    const body = {
      mode: mode === 'draft' || mode === 'post' ? mode : 'record', supplierId, orderId: orderId ? find('orders', orderId)?.uuid ?? null : null, storeId: location(store), challan: challan ?? '', invoice: invoice ?? '', bay: bay ?? '', verified: Boolean(verified), attachments: attachments ?? 0,
      lines: lines.map((line) => ({ itemId: item(line.itemId), ordered: Number(line.ordered) || 0, received: Number(line.received) || 0, rejected: Number(line.rejected) || 0, batches: line.batches.map((batch) => ({ batchNo: batch.batchNo, expiry: batch.expiry, qty: Number(batch.qty), bin: batch.bin ?? '' })) })),
      discrepancies: (discrepancies ?? []).map((entry) => ({ kind: entry.kind, qty: entry.qty, state: entry.state, note: entry.note ?? '', resolution: entry.resolution || null })),
    }
    const current = id && find('receipts', id)
    return current ? inventoryApi.updateReceipt(current.uuid, body) : inventoryApi.createReceipt(body)
  },
  'receipt/resolve': ({ id, discrepancyId, disposition, note }, { find }) => {
    const receipt = find('receipts', id)
    return inventoryApi.resolveDiscrepancy(receipt.uuid, { discrepancyId: receipt.discrepancies.find((entry) => entry.id === discrepancyId).uuid, disposition, note })
  },
  'receipt/post': ({ id }, { find }) => inventoryApi.postReceipt(find('receipts', id).uuid),
  'adjustment/save': ({ id, mode, batchId, proposed, reason, evidence }, { find }) => {
    const body = { mode, batchId, proposed: Number(proposed), reason, evidence }
    const current = id && find('adjustments', id)
    return current ? inventoryApi.updateAdjustment(current.uuid, body) : inventoryApi.createAdjustment(body)
  },
  'supplier/save': ({ id, name, code, contact, phone, email, categories, address, city, state, postal, country, gstin, registration, terms, notes, active }, { find }) => {
    const body = { name, code: code || null, contact, phone, email, categories, address, city, state, postal, country, gstin, registration, terms, notes, active }
    const current = id && find('suppliers', id)
    return current ? inventoryApi.updateSupplier(current.id, current.version, body) : inventoryApi.createSupplier(body)
  },
  'supplier/active': ({ id, active, reason }, { find }) => inventoryApi.setSupplierActive(id, { active, reason: reason ?? '', version: find('suppliers', id).version }),
  'item/save': ({ id, ...item }, { stock }) => {
    const current = id && stock.items.find((entry) => entry.id === id)
    return current ? inventoryApi.updateItem(current.uuid, current.version, item) : inventoryApi.createItem(item)
  },
  'location/create': (body) => inventoryApi.createLocation(body),
  'location/active': ({ id, active }, { location }) => inventoryApi.setLocationActive(location(id), active),
  'rx/dispense': ({ rxId, quantities, consent = {} }, { find, location }) =>
    inventoryApi.dispense(find('rxQueue', rxId).uuid, { locationId: location(dispensaryId()), quantities: Object.fromEntries(Object.entries(quantities).map(([line, qty]) => [line, Number(qty) || 0])), registerConfirmed: Boolean(consent.register), consentConfirmed: Boolean(consent.otp) }),
  'case/create': (payload, { item }) => inventoryApi.createCase({ ...payload, itemId: item(payload.itemId) }),
  'case/decide': ({ id, decision, note, adjust, locationId }, { find, location }) => {
    const entry = find('cases', id)
    return inventoryApi.decideCase(entry.uuid, { decision, note, adjust: Boolean(adjust), locationId: locationId ? location(locationId) : null, version: entry.version })
  },
}
