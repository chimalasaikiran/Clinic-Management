import { useCallback, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { nextId } from '../../patients/format'
import {
  SEED_CAMPAIGNS, SEED_CHANNELS, SEED_CONTENT, SEED_CONTENT_TEMPLATES, SEED_CONVERSATIONS, SEED_ESCALATIONS, SEED_EXECUTIONS, SEED_MESSAGES, SEED_MESSAGE_TEMPLATES,
  SEED_PROFILE, SEED_REVIEW_REQUEST, SEED_REVIEWS, SEED_SCENARIOS, SEED_SEGMENTS, SEED_WORKFLOWS,
} from '../data/seed'
import { GrowthContext } from './growthContext'

const SEED = {
  // Leads live in the API (useLeads); sample campaigns are not linked to any.
  leads: [],
  campaigns: SEED_CAMPAIGNS,
  segments: SEED_SEGMENTS,
  content: SEED_CONTENT,
  contentTemplates: SEED_CONTENT_TEMPLATES,
  reviews: SEED_REVIEWS,
  escalations: SEED_ESCALATIONS,
  conversations: SEED_CONVERSATIONS,
  messages: SEED_MESSAGES,
  messageTemplates: SEED_MESSAGE_TEMPLATES,
  workflows: SEED_WORKFLOWS,
  executions: SEED_EXECUTIONS,
  scenarios: SEED_SCENARIOS,
  channels: SEED_CHANNELS,
  profile: SEED_PROFILE,
  reviewRequest: SEED_REVIEW_REQUEST,
}

// Holds the Growth OS sample records (campaigns, content, reviews, messaging, workflows) in memory so a change in
// one screen shows up in the next. Leads are read from the API instead.
export default function GrowthProvider({ children }) {
  const [data, setData] = useState(SEED)

  const find = useCallback((collection, id) => data[collection].find((item) => item.id === id), [data])
  const newId = useCallback((prefix, collection, width = 4) => nextId(prefix, data[collection].map((item) => item.id), width), [data])

  const add = useCallback((collection, item) => {
    setData((current) => ({ ...current, [collection]: [item, ...current[collection]] }))
    return item
  }, [])

  const update = useCallback((collection, id, patch) => {
    setData((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.id === id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item)),
    }))
  }, [])

  const setSingle = useCallback((key, patch) => setData((current) => ({ ...current, [key]: { ...current[key], ...patch } })), [])

  const value = useMemo(() => ({ data, find, newId, add, update, setSingle }), [data, find, newId, add, update, setSingle])

  return <GrowthContext.Provider value={value}>{children ?? <Outlet />}</GrowthContext.Provider>
}
