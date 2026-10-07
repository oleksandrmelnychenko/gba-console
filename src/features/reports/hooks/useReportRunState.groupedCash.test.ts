import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { groupedCashRequest } from '../data/groupedCashPeriod.test-fixtures'
import { cashPeriodManagementScope } from '../data/cashPeriod.test-fixtures'
import type { ReportRequestBody } from '../types'
import { useReportRunState } from './useReportRunState'
it('invalidates both cash exports when changing account filters or changing to an exact account', () => {
  const data = groupedCashRequest()
  const { result, rerender } = renderHook(({ body }) => useReportRunState<object>(JSON.stringify(body)), { initialProps: { body: data as ReportRequestBody } })
  act(() => result.current.update({ result: { document: { DocumentURL: '/files/cash.xlsx', PdfDocumentURL: '/files/cash.pdf' }, raw: {} } }))
  const filtered = { ...data, selections: [{ IsChecked: true, SelectedField: { Type: 33, Name: 'Kind' },
    FilterCondition: { Type: 0, Name: 'Equals' }, Values: [{ Data: { Id: '1', Name: 'Bank' }, Name: 'Bank', Value: 0 }] }] }
  rerender({ body: filtered }); expect(result.current.result).toBeNull()
  act(() => result.current.update({ result: { document: { DocumentURL: '/files/bank.xlsx' }, raw: {} } }))
  rerender({ body: { ...data, groupedCashPeriod: undefined, cashPeriod: cashPeriodManagementScope } })
  expect(result.current.result).toBeNull()
})
