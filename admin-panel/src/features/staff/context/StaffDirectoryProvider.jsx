import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PEOPLE } from '../data/directory'
import { StaffDirectoryContext } from './staffDirectoryContext'

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const initialsOf = (name) =>
  name
    .replace(/^dr\.?\s+/i, '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

// Holds the workforce directory in memory so a person added in one screen shows up in the next.
// It is replaced by API calls once a backend exists.
export default function StaffDirectoryProvider({ children }) {
  const [people, setPeople] = useState(PEOPLE)

  const addPerson = useCallback((values) => {
    const baseId = slugify(values.fullName)
    let person
    setPeople((current) => {
      const taken = current.filter((entry) => entry.id.startsWith(baseId)).length
      const id = taken ? `${baseId}-${taken + 1}` : baseId
      person = {
        id,
        initials: initialsOf(values.fullName),
        tone: 'slate',
        name: values.fullName.trim(),
        staffCode: `STF-${String(200 + current.length).padStart(3, '0')}`,
        registry: values.councilNumber?.trim() || 'Pending verification',
        type: values.classification === 'doctor' ? 'Doctor' : 'Staff',
        role: values.designation.trim(),
        department: values.department,
        branches: [],
        status: values.masterStatus === 'active' ? 'Active' : 'Pending',
        email: values.email?.trim() || '',
        mobile: values.mobile?.trim() || '',
      }
      return [...current, person]
    })
    return person
  }, [])

  const setBranches = useCallback((id, branches) => {
    setPeople((current) => current.map((person) => (person.id === id ? { ...person, branches } : person)))
  }, [])

  const value = useMemo(
    () => ({ people, getPerson: (id) => people.find((person) => person.id === id), addPerson, setBranches }),
    [people, addPerson, setBranches],
  )

  return <StaffDirectoryContext.Provider value={value}>{children ?? <Outlet />}</StaffDirectoryContext.Provider>
}
