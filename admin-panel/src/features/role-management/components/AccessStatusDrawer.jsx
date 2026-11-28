import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import Drawer from '../../../components/workspace/Drawer'
import { Banner } from '../../../components/workspace/RecordKit'
import { accessApi } from '../../auth/api'

// Confirms suspending or restoring a person's access to this organisation.
export default function AccessStatusDrawer({ member, onClose, onSaved }) {
  const name = member.user.fullName
  const suspending = member.status === 'active'
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')

  const confirm = async () => {
    setPending(true)
    setFailure('')
    try {
      await accessApi.setMemberStatus(member.id, suspending ? 'suspended' : 'active')
      onSaved(suspending ? `${name} is suspended.` : `${name} has access again.`)
    } catch (error) {
      setFailure(error.message)
      setPending(false)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Member access"
      title={suspending ? `Suspend ${name}?` : `Reactivate ${name}?`}
      description={member.user.email}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton onClick={onClose}>Cancel</ActionButton>
          <ActionButton variant={suspending ? 'danger' : 'brand'} onClick={confirm} disabled={pending}>
            {pending ? 'Saving…' : suspending ? 'Suspend access' : 'Restore access'}
          </ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-5 text-[13px] leading-6 text-on-surface-variant">
        {failure && (
          <Banner tone="danger" title="Not saved">
            {failure}
          </Banner>
        )}
        <p>
          {suspending
            ? 'They lose access to this organisation from their next request. Their roles and records are kept, and you can reactivate them later.'
            : 'They get access to this organisation again, with the roles shown in the list.'}
        </p>
      </div>
    </Drawer>
  )
}
