import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PARTNERS } from '../data/options'
import { InsuranceSetupContext } from './insuranceSetupContext'

const INITIAL_DRAFT = {
  acceptance: '',
  methods: [],
  partnerIds: [],
  insurerId: '',
  tpaId: '',
  reference: '',
  startDate: '',
  endDate: '',
  document: null,
  branchIds: [],
  services: [],
}

// Holds the insurance setup draft in memory across the three steps.
// It is replaced by an API call once the insurance settings backend exists.
export default function InsuranceSetupProvider({ children }) {
  const [draft, setDraft] = useState(INITIAL_DRAFT)
  const [unlistedPartners, setUnlistedPartners] = useState([])
  const [savedAt, setSavedAt] = useState(null)

  const update = useCallback((patch) => setDraft((current) => ({ ...current, ...patch })), [])

  const addPartner = useCallback((name, type) => {
    const partner = { id: `unlisted-${Date.now()}`, name: name.trim(), type, unlisted: true }
    setUnlistedPartners((current) => [...current, partner])
    setDraft((current) => ({ ...current, partnerIds: [...current.partnerIds, partner.id] }))
    return partner
  }, [])

  const saveDraft = useCallback(() => setSavedAt(new Date()), [])

  const value = useMemo(() => {
    const partners = [...PARTNERS, ...unlistedPartners]
    return { draft, partners, getPartner: (id) => partners.find((partner) => partner.id === id), update, addPartner, saveDraft, savedAt }
  }, [draft, unlistedPartners, update, addPartner, saveDraft, savedAt])

  return <InsuranceSetupContext.Provider value={value}>{children ?? <Outlet />}</InsuranceSetupContext.Provider>
}
