import { createContext } from 'react'

export const BillingContext = createContext(null)

export const INITIAL_CONFIG = { model: 'Pay-as-you-go', methods: { cash: true, bank: true, upi: true }, advance: '', partial: '', allocation: '', invoiceDoc: '', receiptDoc: '', audit: [] }
