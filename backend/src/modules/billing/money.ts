// Money arithmetic in whole paise, so sums and comparisons never drift. The same rules as the web app's
// lineAmounts/invoiceTotals (admin-panel/src/features/patients/billing.js), rounded half up at each step.

type DecimalLike = { toString(): string } | number | string

export const toPaise = (value: DecimalLike) => Math.round(Number(value.toString()) * 100)
export const rupees = (paise: number) => paise / 100

const percentOf = (paise: number, pct: number) => Math.round((paise * pct) / 100)

export interface LineInput {
  quantity: number
  unitPrice: number
  discountPct: number
  gstPct: number
}

export function lineTotals({ quantity, unitPrice, discountPct, gstPct }: LineInput) {
  const gross = quantity * unitPrice
  const discount = percentOf(gross, discountPct)
  const taxable = gross - discount
  const tax = percentOf(taxable, gstPct)
  return { gross, discount, taxable, tax, total: taxable + tax }
}

export function invoiceTotals(lines: LineInput[]) {
  return lines.map(lineTotals).reduce(
    (sum, line) => ({ gross: sum.gross + line.gross, discount: sum.discount + line.discount, tax: sum.tax + line.tax, total: sum.total + line.total }),
    { gross: 0, discount: 0, tax: 0, total: 0 },
  )
}

// How much of a payment is free to apply or refund: received, less what is applied, refunded or held for a refund.
export function paymentPosition(amount: number, allocated: number, refunds: Array<{ amount: number; status: string; releasesAllocations: boolean }>) {
  const processed = refunds.filter((refund) => refund.status === 'processed').reduce((sum, refund) => sum + refund.amount, 0)
  const open = refunds.filter((refund) => refund.status === 'pending' || refund.status === 'approved')
  const reserved = open.reduce((sum, refund) => sum + refund.amount, 0)
  const unallocated = amount - allocated - processed
  return {
    allocated,
    processed,
    reserved,
    unallocated,
    // Free for a new allocation or an ordinary refund.
    available: unallocated - reserved,
    // Free for a refund that may also take back applied money.
    refundable: amount - processed - reserved,
  }
}
