import { createContext } from 'react'

// Outside the signed-in workspace (or before it loads) there are no branches, alerts or health to show.
export const WorkspaceContext = createContext({
  branches: [],
  branchesLoaded: false,
  branchId: '',
  setBranchId: () => {},
  alerts: null,
  reloadAlerts: () => {},
  notifications: null,
  reloadNotifications: () => {},
  subscribeLive: () => () => {},
  health: null,
})
