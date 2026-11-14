import { useContext } from 'react'
import { StaffDirectoryContext } from './staffDirectoryContext'

export function useStaffDirectory() {
  const value = useContext(StaffDirectoryContext)
  if (!value) throw new Error('useStaffDirectory must be used inside StaffDirectoryProvider')
  return value
}
