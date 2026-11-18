// Reading bank / gateway statements and matching their lines to recorded payments. Pure, so it is unit tested.

export interface ParsedLine {
  row: number
  date: string
  time: string | null
  reference: string
  amount: number // paise
  narration: string
}

export interface ParseResult {
  lines: ParsedLine[]
  errors: Array<{ row: number; issue: string }>
}

export const MAX_STATEMENT_LINES = 5000

// Header names accepted for each column, compared in lower case.
const COLUMNS = {
  date: ['date', 'transaction date', 'txn date', 'value date'],
  time: ['time', 'transaction time', 'txn time'],
  reference: ['reference', 'ref', 'reference no', 'utr', 'transaction id', 'txn id', 'payment id'],
  amount: ['amount', 'credit', 'credit amount', 'amount (inr)'],
  narration: ['narration', 'description', 'remarks', 'details'],
} as const

// Splits CSV text into rows of fields, honouring quoted fields with commas, quotes and line breaks.
export function csvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const source = text.replace(/^﻿/, '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

const pad = (value: string) => value.padStart(2, '0')

// Accepts 2026-11-17, 17/11/2026 and 17-11-2026 (day first, as Indian bank statements print it).
export function statementDate(value: string): string | null {
  const text = value.trim()
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text)
  const [year, month, day] = iso ? [iso[1], iso[2], iso[3]] : dayFirst ? [dayFirst[3], dayFirst[2], dayFirst[1]] : []
  if (!year) return null
  const date = `${year}-${pad(month!)}-${pad(day!)}`
  const check = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(check.getTime()) && check.toISOString().startsWith(date) ? date : null
}

function statementTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
  return `${pad(match[1]!)}:${match[2]}`
}

// "₹1,500.50", "1500.5" and "1,500" are all 150050 paise; anything else is not an amount.
export function statementAmount(value: string): number | null {
  const text = value.replace(/[₹,\s]/g, '').replace(/^INR/i, '')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  return Math.round(Number(text) * 100)
}

export function parseStatement(text: string): ParseResult {
  const rows = csvRows(text)
  if (rows.length === 0) return { lines: [], errors: [{ row: 1, issue: 'The file has no rows.' }] }
  const header = rows[0]!.map((name) => name.trim().toLowerCase())
  const column = (names: readonly string[]) => header.findIndex((name) => names.includes(name))
  const at = { date: column(COLUMNS.date), time: column(COLUMNS.time), reference: column(COLUMNS.reference), amount: column(COLUMNS.amount), narration: column(COLUMNS.narration) }
  const missing = (['date', 'reference', 'amount'] as const).filter((name) => at[name] < 0)
  if (missing.length) return { lines: [], errors: [{ row: 1, issue: `The header row needs ${missing.join(', ')} columns.` }] }
  if (rows.length - 1 > MAX_STATEMENT_LINES) return { lines: [], errors: [{ row: 1, issue: `Import at most ${MAX_STATEMENT_LINES} lines at a time.` }] }

  const lines: ParsedLine[] = []
  const errors: ParseResult['errors'] = []
  const seen = new Set<string>()
  rows.slice(1).forEach((fields, index) => {
    const row = index + 2
    const get = (position: number) => (position >= 0 ? (fields[position] ?? '').trim() : '')
    const date = statementDate(get(at.date))
    const amount = statementAmount(get(at.amount))
    const reference = get(at.reference)
    const time = at.time >= 0 && get(at.time) ? statementTime(get(at.time)) : null
    if (!date) errors.push({ row, issue: 'The date is not a valid date.' })
    else if (!reference) errors.push({ row, issue: 'The reference is empty.' })
    else if (reference.length > 120) errors.push({ row, issue: 'The reference is longer than 120 characters.' })
    else if (amount === null || amount <= 0) errors.push({ row, issue: 'The amount is not a positive number.' })
    else if (at.time >= 0 && get(at.time) && !time) errors.push({ row, issue: 'The time is not a valid time.' })
    else if (seen.has(reference.toLowerCase())) errors.push({ row, issue: `Reference ${reference} appears twice in this file.` })
    else {
      seen.add(reference.toLowerCase())
      lines.push({ row, date, time, reference, amount, narration: get(at.narration).slice(0, 300) })
    }
  })
  return { lines, errors }
}

export interface PaymentForMatching {
  id: string
  txnReference: string | null
  amount: number // paise
  date: string
  cash: boolean
  // Already paired with a statement line.
  matched: boolean
}

export type MatchOutcome =
  | { state: 'matched'; paymentId: string }
  | { state: 'candidate'; paymentId: string }
  | { state: 'exception'; paymentId: string | null; kind: string; reason: string }

const MIN_REFERENCE_IN_NARRATION = 6

// Pairs a statement line with a payment: by the transaction reference first, then (for review only) by an
// unmatched payment of the same amount on the same day. A payment can be matched to one line only.
export function matchLine(line: Pick<ParsedLine, 'reference' | 'narration' | 'amount' | 'date'>, payments: PaymentForMatching[]): MatchOutcome {
  const reference = line.reference.trim().toLowerCase()
  const narration = line.narration.toLowerCase()
  const byReference = payments.find((payment) => {
    const own = payment.txnReference?.trim().toLowerCase()
    return own && (own === reference || (own.length >= MIN_REFERENCE_IN_NARRATION && narration.includes(own)))
  })
  if (byReference) {
    if (byReference.matched) return { state: 'exception', paymentId: byReference.id, kind: 'Duplicate source line', reason: 'This payment is already matched to another statement line. Check whether the source reported it twice.' }
    if (byReference.amount === line.amount) return { state: 'matched', paymentId: byReference.id }
    const difference = (line.amount - byReference.amount) / 100
    return {
      state: 'exception',
      paymentId: byReference.id,
      kind: 'Amount mismatch',
      reason: `The reference matches, but the statement differs from the recorded payment by ${difference > 0 ? '+' : '−'}₹${Math.abs(difference).toLocaleString('en-IN')}. Check for fees or a gross / net difference before resolving; the payment is not changed.`,
    }
  }
  const sameDay = payments.filter((payment) => !payment.matched && !payment.cash && payment.amount === line.amount && payment.date === line.date)
  if (sameDay.length === 1) return { state: 'candidate', paymentId: sameDay[0]!.id }
  return {
    state: 'exception',
    paymentId: null,
    kind: 'Missing ClinicOS record',
    reason: sameDay.length > 1
      ? 'Several recorded payments have this amount and date, and none carries the statement reference. Identify the payment before resolving.'
      : 'No recorded payment carries this reference or matches its amount and date. Do not create a payment from the statement line without identifying the payer.',
  }
}
