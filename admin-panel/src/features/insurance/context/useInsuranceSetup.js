import { useContext } from 'react'
import { InsuranceSetupContext } from './insuranceSetupContext'

export function useInsuranceSetup() {
  const value = useContext(InsuranceSetupContext)
  if (!value) throw new Error('useInsuranceSetup must be used inside InsuranceSetupProvider')
  return value
}
