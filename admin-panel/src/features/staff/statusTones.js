const TONES = {
  Present: 'success',
  Late: 'warning',
  Absent: 'danger',
  'Not Scheduled Here': 'neutral',
}

// Leave variants ("Leave (Approved Holiday)") share one tone.
export const attendanceTone = (status) => TONES[status] ?? (status.startsWith('Leave') ? 'info' : 'neutral')
