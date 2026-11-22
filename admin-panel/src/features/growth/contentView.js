// Labels and checks for the content, business profile and review screens.

export const CONTENT_CATEGORIES = ['Prevention', 'Health education', 'Clinic announcements', 'Offers']
export const TARGETS = { facebook: 'Facebook', instagram: 'Instagram' }
export const CONTENT_STATUSES = { draft: 'Draft', in_review: 'In review', scheduled: 'Scheduled', publishing: 'Publishing', published: 'Published', failed: 'Failed' }
export const CONTENT_TONE = { draft: 'neutral', in_review: 'warning', scheduled: 'info', publishing: 'brand', published: 'success', failed: 'danger' }
export const PUBLICATION_STATUSES = { pending: 'Waiting', publishing: 'Publishing', published: 'Published', failed: 'Failed', unknown: 'Outcome unknown' }
export const PUBLICATION_TONE = { pending: 'neutral', publishing: 'brand', published: 'success', failed: 'danger', unknown: 'warning' }

export const PROFILE_CATEGORIES = ['Medical clinic', 'Dental clinic', 'Physiotherapy clinic', 'Preventive healthcare clinic', 'Diagnostic centre', 'Multi-specialty clinic']

export const RESPONSE_STATES = { none: 'No reply', draft: 'Draft reply', in_review: 'Reply in review', posting: 'Reply approved · posting', posted: 'Replied', failed: 'Reply failed', replied: 'Replied on Google' }
export const RESPONSE_TONE = { none: 'neutral', draft: 'neutral', in_review: 'warning', posting: 'brand', posted: 'success', failed: 'danger', replied: 'success' }
export const SEVERITIES = { low: 'Low', medium: 'Medium', high: 'High' }
export const ESCALATION_STATUSES = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' }

export const targetsLabel = (targets) => targets.map((target) => TARGETS[target]).join(' + ')

// Public text must not carry personal or clinical detail. The server checks the same before a reply is submitted.
const SENSITIVE = [
  [/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/, 'a phone number'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/, 'an email address'],
  [/\b(diagnos\w*|prescri\w*|treatment|surgery|medicine|medication|your (visit|appointment) on|test results?|your condition)\b/i, 'clinical wording'],
]

export const privacyFindings = (text) => SENSITIVE.filter(([pattern]) => pattern.test(text)).map(([, label]) => label)

export const stars = (rating) => `${rating} / 5 ★`
