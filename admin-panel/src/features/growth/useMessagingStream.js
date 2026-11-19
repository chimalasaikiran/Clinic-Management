import { useEffect, useRef } from 'react'
import { useAuth } from '../auth/context/useAuth'
import { messagingApi } from './messagingApi'

// Calls `onChange({ type, conversationId, messageId })` whenever the server says a conversation or message changed.
// The browser reconnects by itself if the connection drops.
export function useMessagingStream(onChange) {
  const { orgId } = useAuth()
  const handler = useRef(onChange)
  useEffect(() => {
    handler.current = onChange
  })

  useEffect(() => {
    if (!orgId) return undefined
    const source = messagingApi.stream(orgId)
    if (!source) return undefined
    const relay = (type) => (event) => {
      try {
        handler.current({ type, ...JSON.parse(event.data) })
      } catch {
        // A malformed event is ignored; the next one still arrives.
      }
    }
    const onConversation = relay('conversation')
    const onMessage = relay('message')
    source.addEventListener('conversation', onConversation)
    source.addEventListener('message', onMessage)
    return () => {
      source.removeEventListener('conversation', onConversation)
      source.removeEventListener('message', onMessage)
      source.close()
    }
  }, [orgId])
}
