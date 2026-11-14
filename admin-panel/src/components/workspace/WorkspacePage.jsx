import WorkspaceFooter from './WorkspaceFooter'
import WorkspaceLayout from './WorkspaceLayout'

// Shared frame for workspace screens: app shell, content, footer.
export default function WorkspacePage({ children }) {
  return (
    <WorkspaceLayout>
      <div>
        {children}
        <WorkspaceFooter />
      </div>
    </WorkspaceLayout>
  )
}
