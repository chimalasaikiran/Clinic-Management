import { createContext, useContext } from 'react'

export const GrowthContext = createContext(null)

export function useGrowth() {
  const value = useContext(GrowthContext)
  if (!value) throw new Error('useGrowth must be used inside <GrowthProvider>')
  return value
}
