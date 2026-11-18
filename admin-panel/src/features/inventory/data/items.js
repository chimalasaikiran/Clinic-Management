// The item master, loaded from the API by StockProvider (see setItems). `safety` is the pharmacy-level buffer,
// `reorder` the central-store threshold. The array is filled in place so the screens that import it keep working.
export const ITEMS = []

export function setItems(items) {
  ITEMS.splice(0, ITEMS.length, ...items)
}

export const itemById = (id) => ITEMS.find((entry) => entry.id === id)

export const unitLabel = (entry, quantity) => (quantity === 1 ? entry.unit : entry.unitPlural)
