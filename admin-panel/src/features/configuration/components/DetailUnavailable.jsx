import ActionButton from '../../../components/workspace/ActionButton'
import PageIntro from '../../../components/workspace/PageIntro'
import Panel from '../../../components/workspace/Panel'
import ConfigPage from './ConfigPage'

// Shown when a detail route is opened for a record the sample data does not cover yet.
export default function DetailUnavailable({ title, backTo, backLabel }) {
  return (
    <ConfigPage>
      <PageIntro title={title} description="Detailed configuration for this record is not available yet." />
      <Panel>
        <p className="text-sm text-on-surface-variant">Only Cardiology has detailed configuration in this build. The other records link here until their data is connected.</p>
        <ActionButton to={backTo} className="mt-4">
          {backLabel}
        </ActionButton>
      </Panel>
    </ConfigPage>
  )
}
