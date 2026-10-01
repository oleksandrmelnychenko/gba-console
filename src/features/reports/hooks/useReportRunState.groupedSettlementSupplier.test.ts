import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { ReportRequestBody } from '../types'
import { groupedSettlementSupplierRequest, supplierSelection } from '../data/groupedSettlementSupplier.test-fixtures'
import { useReportRunState } from './useReportRunState'

it('invalidates both exports when the genuine supplier or supplier-contract selection changes', () => {
  const data = groupedSettlementSupplierRequest(); delete data.sourceBuyerSubtree
  data.selections = [supplierSelection(17, '9007199254740993')]
  const { result, rerender } = renderHook(({ body }) => useReportRunState<object>(JSON.stringify(body)),
    { initialProps: { body: data as ReportRequestBody } })
  act(() => result.current.update({ result: { document: { DocumentURL: '/files/supplier.xlsx', PdfDocumentURL: '/files/supplier.pdf' }, raw: {} } }))
  rerender({ body: { ...data, selections: [supplierSelection(18, '9223372036854775807')] } })
  expect(result.current.result).toBeNull()
  act(() => result.current.update({ result: { document: { DocumentURL: '/files/agreement.xlsx', PdfDocumentURL: '/files/agreement.pdf' }, raw: {} } }))
  rerender({ body: { ...data, selections: [supplierSelection(18, '9007199254740994')] } })
  expect(result.current.result).toBeNull()
})
