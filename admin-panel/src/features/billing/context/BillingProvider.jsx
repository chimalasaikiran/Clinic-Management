import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { toLedgerView } from '../adapters'
import { billingApi } from '../api'
import { BillingContext } from './billingContext'

const EMPTY = toLedgerView({ branches: [], patients: [], services: [], settings: { billingModel: 'Pay-as-you-go', cashEnabled: true, bankEnabled: true, upiEnabled: true, advancePolicy: '', partialPolicy: '', allocationPolicy: '', invoiceDocument: '', receiptDocument: '', version: null, events: [] }, charges: [], invoices: [], payments: [], refunds: [], statementImports: [], statementLines: [], exceptions: [] })

// Loads the finance ledger from the API (the whole organisation, or one patient when `patientId` is given) and
// runs every change through it, reloading afterwards so each screen shows the balances the server holds.
// People without a finance permission get an empty ledger marked `restricted`, so shared screens such as the
// reports overview still open.
export default function BillingProvider({ children, patientId, inline = false }) {
  const auth = useAuth()
  const [state, setState] = useState({ status: 'loading', ledger: null, error: null, restricted: false })
  const latest = useRef(0)

  // Applies a ledger response, ignoring any that a newer request has overtaken.
  const settle = useCallback((request, promise) => promise.then(
    (data) => request === latest.current && setState({ status: 'ready', ledger: toLedgerView(data), error: null, restricted: false }),
    (error) => {
      if (request !== latest.current) return
      if (error.status === 403) setState({ status: 'ready', ledger: EMPTY, error: null, restricted: true })
      else setState((current) => ({ ...current, status: current.ledger ? 'ready' : 'error', error }))
    },
  ), [])

  const load = useCallback(() => settle(++latest.current, billingApi.ledger(patientId)), [patientId, settle])

  useEffect(() => {
    settle(++latest.current, billingApi.ledger(patientId))
  }, [patientId, settle])

  // Runs a change and reloads the ledger; errors reach the caller, which shows them next to the action.
  const run = useCallback(async (change) => {
    const result = await change()
    await load()
    return result
  }, [load])

  const value = useMemo(() => {
    const ledger = state.ledger ?? EMPTY
    const patients = new Map(ledger.patients.map((patient) => [patient.id, patient]))
    const orgName = auth.organisation?.organisation.name ?? 'Your organisation'
    const active = ledger.branches.filter((branch) => branch.active)
    return {
      ...ledger,
      status: state.status,
      error: state.error,
      restricted: state.restricted,
      reload: load,
      getPatient: (id) => patients.get(id),
      orgName,
      locationText: active.length === 1 ? active[0].name : `All locations (${active.length})`,
      scopeText: `${orgName} · ${active.length === 1 ? active[0].name : `All locations (${active.length})`}`,
      saveService: (service, { id, version } = {}) => run(() => (id ? billingApi.updateService(id, version, service) : billingApi.createService(service))),
      setServiceStatus: (id, body) => run(() => billingApi.setServiceStatus(id, body)),
      saveConfig: (body) => run(() => billingApi.saveSettings(body)),
      createCharge: (body) => run(() => billingApi.createCharge(body)),
      updateCharge: (id, body) => run(() => billingApi.updateCharge(id, body)),
      createInvoice: (body) => run(() => billingApi.createInvoice(body)),
      recordPayment: (body) => run(() => billingApi.recordPayment(body)),
      allocate: (paymentUuid, body) => run(() => billingApi.allocate(paymentUuid, body)),
      requestRefund: (body) => run(() => billingApi.requestRefund(body)),
      decideRefund: (action, id, body) => run(() => billingApi[`${action}Refund`](id, body)),
      importStatement: (body) => run(() => billingApi.importStatement(body)),
      confirmLine: (id, note) => run(() => billingApi.confirmLine(id, note)),
      rejectLine: (id, note) => run(() => billingApi.rejectLine(id, note)),
      reviewException: (id, version) => run(() => billingApi.reviewException(id, version)),
      recordEvidence: (id, body) => run(() => billingApi.recordEvidence(id, body)),
      resolveException: (id, body) => run(() => billingApi.resolveException(id, body)),
    }
  }, [state, load, run, auth.organisation])

  const content = children ?? <Outlet />
  if (state.status !== 'ready') {
    const placeholder = <LoadingState label="Loading billing records…" error={state.status === 'error' ? state.error : null} onRetry={load} />
    return inline ? placeholder : <WorkspacePage>{placeholder}</WorkspacePage>
  }
  return <BillingContext.Provider value={value}>{content}</BillingContext.Provider>
}
