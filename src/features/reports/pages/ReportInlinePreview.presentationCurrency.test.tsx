import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ReportInlinePreview } from './ReportInlinePreview'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { documentPreviewPayload } from '../data/currentFinancialDocumentAxes.test-fixtures'
import { resolvedCurrency } from '../data/reportPresentationCurrency.test-fixtures'
it('uses producer target captions and units, preserves unknown amounts and discloses own-document policy', () => {
 const wire = documentPreviewPayload()
 wire.Columns[0].Values.at(-1)!.Caption = 'Продажі з ПДВ, CAD retail'
 wire.Cells[0].Value = { Kind: 'null', Value: null, Provenance: 'producerCell' }
 const preview = normalizeNativeReportPreview({ Preview: { ...wire,
   Request: { ...wire.Request, presentationCurrency: { ...resolvedCurrency, code: 'CAD retail' } },
   valueSemantics: [{ columnSourceIndex: 0, measureType: 2, semantics: { kind: 'money', currencyPolicy: 'CAD retail', unitPolicy: 'currency', aggregation: 'sum', scalable: true, defaultDecimalPlaces: 2 } }],
 } })
 render(<MantineProvider><ReportInlinePreview preview={preview} /></MantineProvider>)
 expect(screen.getByText(/Валюта звіту: CAD retail/)).toBeTruthy()
 expect(screen.getByRole('columnheader', { name: /Продажі з ПДВ, CAD retail/ }).getAttribute('title')).toBe('CAD retail')
 expect(screen.getByRole('cell').textContent).toBe('∅')
 expect(screen.queryByText(/EUR/)).toBeNull()
})
