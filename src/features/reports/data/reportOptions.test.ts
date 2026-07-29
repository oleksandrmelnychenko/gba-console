import { describe, expect, it } from 'vitest'
import {
  REPORT_FILTER_FIELD_GROUPS,
  REPORT_FILTER_FIELD_TYPES,
  flattenGroupingOptions,
  sanitizeReportTemplate,
} from './reportOptions'
import type { ReportRequestBody } from '../types'

const SALE_RETURN_DOCUMENT_GROUPING = 18
const SUPPLIER_GROUPING = 21
const CUSTOMER_MANAGER_GROUPING = 16
const SALE_DOCUMENT_MANAGER_INPUT_GROUPING = 19

function template(data: Partial<ReportRequestBody>): ReportRequestBody {
  return {
    from: '2026-06-01',
    selections: [],
    sorted: { Col: [], Measurements: [], Row: [] },
    to: '2026-06-30',
    ...data,
  }
}

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
  it('keeps a saved template that groups by the returns dimension and the supplier', () => {
    const { data, removedCount } = sanitizeReportTemplate(template({
      sorted: {
        Col: [{ key: 'SaleReturnDocument', label: 'SaleReturnDocument', type: SALE_RETURN_DOCUMENT_GROUPING }],
        Measurements: [],
        Row: [{ key: 'Supplier', label: 'Supplier', type: SUPPLIER_GROUPING }],
      },
    }))

    expect(removedCount).toBe(0)
    expect(data.sorted.Row).toEqual([{ key: 'Supplier', label: 'Постачальник', type: SUPPLIER_GROUPING }])
    // relabelled from the current option list, not trusted as stored: a template saved while the option was
    // withheld carries the bare enum name, and the axis captions come from what the form is handed
    expect(data.sorted.Col).toEqual([
      { key: 'SaleReturnDocument', label: 'Повернення від клієнта', type: SALE_RETURN_DOCUMENT_GROUPING },
    ])
  })

  it('keeps a saved template that filters on a return document', () => {
    const { data, removedCount } = sanitizeReportTemplate(template({
      selections: [
        {
          FilterCondition: { Name: 'У списку', Type: 2 },
          IsChecked: true,
          SelectedField: { Name: 'SaleReturnDocument', ParentType: 'SaleDocument', Type: 14 },
          Values: [{ Data: { Id: 51835, Number: 'К0000000121' }, Name: 'К0000000121', Value: 0 }],
        },
      ],
    }))

    expect(removedCount).toBe(0)
    expect(data.selections).toHaveLength(1)
    expect(data.selections[0].SelectedField.Type).toBe(REPORT_FILTER_FIELD_TYPES.saleReturnDocument)
    expect(data.selections[0].Values).toHaveLength(1)
  })

  it('still remaps «Менеджер клієнта» onto the grouping that has the same server behaviour', () => {
    const { data, removedCount } = sanitizeReportTemplate(template({
      sorted: {
        Col: [],
        Measurements: [],
        Row: [{ key: 'CustomerManager', label: 'Менеджер клієнта', type: CUSTOMER_MANAGER_GROUPING }],
      },
    }))

    expect(removedCount).toBe(0)
    expect(data.sorted.Row[0].type).toBe(SALE_DOCUMENT_MANAGER_INPUT_GROUPING)
    expect(data.sorted.Row[0].label).toBe('Ввів документ')
  })

  it('still drops a condition the engine refuses outright', () => {
    const { data, removedCount } = sanitizeReportTemplate(template({
      selections: [
        {
          FilterCondition: { Name: 'У групі', Type: 6 },
          IsChecked: true,
          SelectedField: { Name: 'ProductGroup', ParentType: 'Product', Type: 4 },
          Values: [{ Data: { Id: 1 }, Name: 'Аксессуары', Value: 0 }],
        },
      ],
    }))

    expect(removedCount).toBe(1)
    expect(data.selections).toEqual([])
  })

  it('still drops a measure the engine hardcodes to zero', () => {
    const { data, removedCount } = sanitizeReportTemplate(template({
      sorted: {
        Col: [],
        Measurements: [{ IsChecked: true, Name: 'CostVAT', Type: 7, parentName: 'Cost' }],
        Row: [],
      },
    }))

    expect(removedCount).toBe(1)
    expect(data.sorted.Measurements).toEqual([])
  })

  it('passes a grouping it has never heard of through untouched rather than emptying the template', () => {
    const { data, removedCount } = sanitizeReportTemplate(template({
      sorted: {
        Col: [],
        Measurements: [],
        Row: [{ key: 'SomethingNewer', label: 'Щось нове', type: 99 }],
      },
    }))

    expect(removedCount).toBe(0)
    expect(data.sorted.Row).toEqual([{ key: 'SomethingNewer', label: 'Щось нове', type: 99 }])
  })
})
