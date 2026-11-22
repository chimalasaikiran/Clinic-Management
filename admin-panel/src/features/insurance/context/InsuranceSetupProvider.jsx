import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useApiResource } from '../../../hooks/useApiResource'
import { configApi } from '../../configuration/api'
import { workspaceApi } from '../../workspace/api'
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
  // The chosen PDF until it is uploaded, then the saved document.
  file: null,
  document: null,
  branchIds: [],
  services: [],
}

// One key per partner, the same whether it comes from the built-in list or the clinic's saved partners.
const keyOf = (type, name) => `${type.toLowerCase()}:${name.trim().toLowerCase()}`
const label = (type) => (type === 'tpa' ? 'TPA' : 'Insurer')

// The insurance setup across its three steps. Partners and the agreement are saved through the API; the draft
// here is what the steps are editing, filled from what was saved before.
export default function InsuranceSetupProvider({ children }) {
  const overview = useApiResource(() => configApi.insurance(), 'insurance-overview')
  const branchList = useApiResource(() => workspaceApi.branches(), 'insurance-branches')
  const [draft, setDraft] = useState(INITIAL_DRAFT)
  const [unlisted, setUnlisted] = useState([])
  const [loaded, setLoaded] = useState(false)
  const saved = overview.data

  // The saved setup, once, as the starting draft: the latest draft agreement (or the active one).
  if (saved && !loaded) {
    const agreement = saved.agreements.find((entry) => entry.status === 'draft') ?? saved.agreements.find((entry) => entry.status === 'active') ?? null
    const activePartners = saved.partners.filter((partner) => partner.active)
    setLoaded(true)
    setDraft((current) => ({
      ...current,
      acceptance: saved.acceptsInsurance === null ? '' : saved.acceptsInsurance ? 'yes' : 'no',
      partnerIds: activePartners.map((partner) => keyOf(partner.type, partner.name)),
      ...(agreement ? {
        methods: agreement.methods, insurerId: keyOf('insurer', agreement.insurer.name), tpaId: agreement.tpa ? keyOf('tpa', agreement.tpa.name) : '', reference: agreement.reference,
        startDate: agreement.startDate, endDate: agreement.endDate, document: agreement.document, branchIds: agreement.branches.map((branch) => branch.id), services: agreement.coverage,
      } : {}),
    }))
  }

  const update = useCallback((patch) => setDraft((current) => ({ ...current, ...patch })), [])

  const addPartner = useCallback((name, type) => {
    const partner = { id: keyOf(type, name), name: name.trim(), type, unlisted: true }
    setUnlisted((current) => [...current, partner])
    setDraft((current) => ({ ...current, partnerIds: [...current.partnerIds, partner.id] }))
    return partner
  }, [])

  const value = useMemo(() => {
    const fromList = PARTNERS.map((partner) => ({ ...partner, id: keyOf(partner.type, partner.name) }))
    const fromSaved = (saved?.partners ?? []).map((partner) => ({ id: keyOf(partner.type, partner.name), name: partner.name, type: label(partner.type), unlisted: !partner.listed, savedId: partner.id, active: partner.active }))
    const byKey = new Map([...fromList, ...unlisted, ...fromSaved].map((partner) => [partner.id, { ...(fromList.find((entry) => entry.id === partner.id) ?? {}), ...partner }]))
    const partners = [...byKey.values()]
    const agreement = saved?.agreements.find((entry) => entry.status === 'draft') ?? saved?.agreements.find((entry) => entry.status === 'active') ?? null

    // Step 1: the answer, and the selected partners added (deselected saved ones turned off).
    const saveAcceptance = async () => {
      await configApi.setAcceptance(draft.acceptance === 'yes')
      if (draft.acceptance === 'yes') {
        for (const partner of partners) {
          const selected = draft.partnerIds.includes(partner.id)
          if (selected && (!partner.savedId || !partner.active)) await configApi.addPartner({ name: partner.name, type: partner.type === 'TPA' ? 'tpa' : 'insurer', listed: !partner.unlisted })
          else if (!selected && partner.savedId && partner.active) await configApi.setPartnerActive(partner.savedId, false)
        }
      }
      overview.reload()
    }

    // Step 2: the draft agreement, created or updated, with its PDF uploaded first.
    const saveAgreement = async () => {
      const latest = await configApi.insurance()
      const idOf = (key) => latest.partners.find((partner) => keyOf(partner.type, partner.name) === key)?.id ?? null
      const document = draft.file ? await configApi.uploadAgreement(draft.file) : draft.document
      const body = {
        insurerId: idOf(draft.insurerId), tpaId: draft.tpaId ? idOf(draft.tpaId) : null, reference: draft.reference.trim(), startDate: draft.startDate, endDate: draft.endDate,
        documentId: document?.id ?? null, branchIds: draft.branchIds, methods: draft.methods, coverage: draft.services,
      }
      const existing = latest.agreements.find((entry) => entry.status === 'draft')
      const result = existing ? await configApi.updateAgreement(existing.id, { ...body, version: existing.version }) : await configApi.createAgreement(body)
      setDraft((current) => ({ ...current, file: null, document: result.document }))
      overview.reload()
      return result
    }

    const activate = async () => {
      await configApi.activateAgreement(agreement.id, agreement.version)
      overview.reload()
    }

    return {
      draft, partners, getPartner: (id) => byKey.get(id), update, addPartner, saveAcceptance, saveAgreement, activate,
      agreement, ready: Boolean(saved) && loaded, error: overview.error, reload: overview.reload,
      branches: (branchList.data ?? []).filter((branch) => branch.status === 'active'),
    }
  }, [draft, saved, unlisted, update, addPartner, overview, branchList.data, loaded])

  return <InsuranceSetupContext.Provider value={value}>{children ?? <Outlet />}</InsuranceSetupContext.Provider>
}
