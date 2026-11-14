// "₹12,84,500" in the Indian digit grouping.
export const rupees = (value) => `${value < 0 ? '−' : ''}₹${Math.abs(Math.round(value)).toLocaleString('en-IN')}`

// "+₹8,500" / "−₹12,000"; zero is shown without a sign.
export const signed = (value) => (value > 0 ? `+${rupees(value)}` : rupees(value))

// A deduction shown as a negative figure, or a dash when nothing is deducted.
export const minus = (value) => (value ? rupees(-value) : '—')
