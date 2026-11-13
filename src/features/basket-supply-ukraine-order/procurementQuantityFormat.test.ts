import { describe, expect, it } from 'vitest'
import { describeLeadTimeBasis, formatProcurementQuantity } from './procurementQuantityFormat'

describe('formatProcurementQuantity', () => {
  it('appends the unit of measure when the line carries one', () => {
    expect(formatProcurementQuantity(12, 'шт')).toBe('12\u00a0шт')
    expect(formatProcurementQuantity(2.5, ' л ')).toBe('2,5\u00a0л')
  })

  it('prints the bare quantity when the unit is unknown', () => {
    expect(formatProcurementQuantity(12, null)).toBe('12')
    expect(formatProcurementQuantity(12, '  ')).toBe('12')
    expect(formatProcurementQuantity(12)).toBe('12')
  })
})

describe('describeLeadTimeBasis', () => {
  it('names how the lead time was obtained', () => {
    expect(describeLeadTimeBasis('measured', 14)).toBe('виміряний за 14 поставками')
    expect(describeLeadTimeBasis('measured', null)).toBe('виміряний за поставками')
    expect(describeLeadTimeBasis('measured', 61)).toBe('виміряний за 61 поставкою')
    expect(describeLeadTimeBasis('measured', 1)).toBe('виміряний за 1 поставкою')
    expect(describeLeadTimeBasis('default', null)).toBe('типовий')
    expect(describeLeadTimeBasis('override', 3)).toBe('задано вручну')
  })

  it('says when outliers were left out of the average', () => {
    expect(describeLeadTimeBasis('measured', 14, 'trimmed_mean')).toBe('виміряний за 14 поставками, усереднено без викидів')
    expect(describeLeadTimeBasis('measured', 14, 'mean')).toBe('виміряний за 14 поставками')
    expect(describeLeadTimeBasis('default', null, 'trimmed_mean')).toBe('типовий')
  })

  it('stays silent for an older service that does not send the basis', () => {
    expect(describeLeadTimeBasis(null, 5)).toBeNull()
    expect(describeLeadTimeBasis(undefined, undefined)).toBeNull()
  })
})
