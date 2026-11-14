import ActionButton from '../../../components/workspace/ActionButton'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { ROUTES } from '../../../config/routes'

// Shown for an id that is not in the directory, or whose detail records are not connected yet.
export default function StaffNotFound({ title = 'Staff member', reason = 'We could not find this person in the directory.' }) {
  return (
    <WorkspacePage>
      <PageIntro title={title} description={reason} />
      <Panel>
        <ActionButton to={ROUTES.staffDirectory}>Back to Staff Directory</ActionButton>
      </Panel>
    </WorkspacePage>
  )
}
