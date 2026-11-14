import { useContext } from 'react'
import { PayrollContext } from './payrollContext'

export function usePayroll() {
  const value = useContext(PayrollContext)
  if (!value) throw new Error('usePayroll must be used inside PayrollProvider')
  return value
}
