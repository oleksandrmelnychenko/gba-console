import { describe, expect, it } from 'vitest'
import {
  measurementGroupCaption,
  REPORT_FILTER_FIELD_GROUPS,
  REPORT_FILTER_FIELD_TYPES,
  flattenGroupingOptions,
  
} from './reportOptions'

const SALE_RETURN_DOCUMENT_GROUPING = 18
const SUPPLIER_GROUPING = 21

// The server implements «Повернення від клієнта» and «Постачальник» — the grouping and the filter both read the
// document a sale line is attributed to, and the supplier comes off the consignment lot the line consumed. While
// it did not, the console withheld all three AND stripped them out of saved templates; offering them again is
// only half the repair if a template that carries one still comes back empty.
describe('restored report options', () => {
  it('offers the two groupings the engine now answers', () => {
    const types = flattenGroupingOptions().map((item) => item.type)

    expect(types).toContain(SALE_RETURN_DOCUMENT_GROUPING)
    expect(types).toContain(SUPPLIER_GROUPING)
  })

  it('offers the return-document filter field', () => {
    const fieldTypes = REPORT_FILTER_FIELD_GROUPS.flatMap((group) => group.children.map((child) => child.type))

    expect(fieldTypes).toContain(REPORT_FILTER_FIELD_TYPES.saleReturnDocument)
  })
})

describe('sanitizeReportTemplate', () => {
})

it('appends the percent sign to a profitability group label only once', () => {
  expect(measurementGroupCaption('Profitability', 'Рентабельність')).toBe('Рентабельність, %')
  expect(measurementGroupCaption('Profitability', 'Рентабельність без ПДВ, %')).toBe('Рентабельність без ПДВ, %')
  expect(measurementGroupCaption('Sales', 'Продажі')).toBe('Продажі')
})
