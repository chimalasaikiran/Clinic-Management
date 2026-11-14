const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`

// Downloads rows (an array of equal-length arrays, first row the headings) as a CSV file.
export function exportCsv(filename, rows) {
  const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
