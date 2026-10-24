import { expect } from 'vitest'
/** pdfmake replaces strings with normalized objects in place, including header and subtotal cells. */
export function assertPdfMatrixIsolation(headers: string[], matrix: () => string[][], definition: () => { content: unknown[] }) {
  const beforeHeaders = [...headers], beforeMatrix = matrix()
  const table = definition().content.find(item => typeof item === 'object' && item !== null && 'table' in item) as { table: { body: unknown[][] } }
  expect(table.table.body[0]).not.toBe(headers)
  table.table.body.forEach(row => row.forEach((text, index) => { row[index] = { text, fillColor: '#fff', _margin: null } }))
  expect(headers).toEqual(beforeHeaders)
  expect(matrix()).toEqual(beforeMatrix)
}
