import { useContext } from 'react'
import { BillingContext } from './billingContext'

export function useBilling() {
  const value = useContext(BillingContext)
  if (!value) throw new Error('useBilling must be used inside <BillingProvider>')
  return value
}
