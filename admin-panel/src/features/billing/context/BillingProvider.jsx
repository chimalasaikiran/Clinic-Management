import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SEED_EXCEPTIONS, SEED_REFUND_REQUESTS } from '../data/financeSeed'
import { SEED_SERVICES } from '../data/seedServices'
import { BillingContext, INITIAL_CONFIG } from './billingContext'

// Holds the service catalogue, billing defaults and the refund and reconciliation workflows in memory until the billing API exists.
export default function BillingProvider({ children }) {
  const [services, setServices] = useState(SEED_SERVICES)
  const [config, setConfig] = useState(INITIAL_CONFIG)
  const [refundRequests, setRefundRequests] = useState(SEED_REFUND_REQUESTS)
  const [exceptions, setExceptions] = useState(SEED_EXCEPTIONS)

  const saveService = useCallback((service) => setServices((current) => (current.some((entry) => entry.id === service.id) ? current.map((entry) => (entry.id === service.id ? service : entry)) : [...current, service])), [])
  const saveConfig = useCallback((next) => setConfig(next), [])
  const addRefundRequest = useCallback((request) => setRefundRequests((current) => [request, ...current]), [])
  const updateRefundRequest = useCallback((id, patch) => setRefundRequests((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))), [])
  const updateException = useCallback((id, patch) => setExceptions((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))), [])
  const value = useMemo(
    () => ({ services, config, refundRequests, exceptions, saveService, saveConfig, addRefundRequest, updateRefundRequest, updateException }),
    [services, config, refundRequests, exceptions, saveService, saveConfig, addRefundRequest, updateRefundRequest, updateException],
  )

  return <BillingContext.Provider value={value}>{children ?? <Outlet />}</BillingContext.Provider>
}
