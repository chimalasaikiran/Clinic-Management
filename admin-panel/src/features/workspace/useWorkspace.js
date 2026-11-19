import { useContext } from 'react'
import { WorkspaceContext } from './workspaceContext'

export const useWorkspace = () => useContext(WorkspaceContext)
