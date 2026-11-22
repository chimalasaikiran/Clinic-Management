const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface Session {
  weekday: number
  start: string
  end: string
}

export interface Window extends Session {
  branchId: string
  branchName: string
}

// Doctor sessions that are not inside one of the branch's open sessions that day. Branches without hours set
// are not checked. These are warnings: booking still follows the doctor's own availability.
export function outsideBranchHours(windows: Window[], hoursByBranch: Map<string, Session[]>): string[] {
  const warnings: string[] = []
  for (const window of windows) {
    const hours = hoursByBranch.get(window.branchId)
    if (!hours?.length) continue
    const open = hours.filter((session) => session.weekday === window.weekday)
    const inside = open.some((session) => session.start <= window.start && window.end <= session.end)
    if (inside) continue
    const opening = open.length ? open.map((session) => `${session.start}–${session.end}`).join(', ') : 'closed'
    warnings.push(`${DAYS[window.weekday]} ${window.start}–${window.end} at ${window.branchName} is outside the branch’s hours (${opening}).`)
  }
  return warnings
}
