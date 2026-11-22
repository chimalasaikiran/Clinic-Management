import { privacyFindings as findings } from './contentView'

// ---- Message templates and privacy ---------------------------------------------------------------------------

export function templateVariables(body) {
  return [...new Set([...body.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]))]
}

export function renderTemplate(body, values) {
  return body.replace(/{{\s*(\w+)\s*}}/g, (token, name) => values[name] ?? token)
}

// How many kinds of personal or clinical detail a message contains (a phone number, an email, clinical wording).
export const privacyFindings = (text) => findings(text).length

// ---- Content calendar -------------------------------------------------------------------------------------

// Monday-first grid of ISO dates covering `year`/`month` (0-based).
export function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1))
  const start = new Date(first)
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7))
  const weeks = []
  const cursor = new Date(start)
  do {
    weeks.push(Array.from({ length: 7 }, () => { const iso = cursor.toISOString().slice(0, 10); cursor.setUTCDate(cursor.getUTCDate() + 1); return iso }))
  } while (cursor.getUTCMonth() === month || weeks.length < 4)
  return weeks
}

export const shiftMonth = ({ year, month }, delta) => { const date = new Date(Date.UTC(year, month + delta, 1)); return { year: date.getUTCFullYear(), month: date.getUTCMonth() } }
