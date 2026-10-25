import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { documentPreviewPayload } from '../data/currentFinancialDocumentAxes.test-fixtures'
import { normalizeNativeReportPreview } from '../data/nativeReportPreview'
import { ReportInlinePreview } from './ReportInlinePreview'

it('keeps sale42, return42 and a large ID distinct despite identical captions, without merging absent and unknown cells', () => {
  const raw = documentPreviewPayload([5], [81]), caption = 'Документ №42 · 17.10.2026 10:30:21'
  raw.Columns = ['sale:42', 'return:42', 'sale:9007199254740993'].map((Value, index) => ({
    Ordinal: index, SourceIndex: index, Values: [
      { Caption: caption, Identity: { Kind: 'text', Value, Provenance: 'columnAxisKey' } },
      { Caption: 'Прибуток', Identity: { Kind: 'text', Value: 'profit', Provenance: 'columnAxisKey' } },
      { Caption: 'Продажі', Identity: { Kind: 'reportField', Value: 'SalesValueWithVAT', Provenance: 'columnAxisKey' } },
    ],
  }))
  raw.Cells = [{ RowSourceIndex: 0, ColumnSourceIndex: 1, Value: { Kind: 'null', Value: null, Provenance: 'producerCell' } }]
  const preview = normalizeNativeReportPreview({ Preview: raw })
  const view = render(<MantineProvider env="test"><ReportInlinePreview preview={preview} /></MantineProvider>)
  for (const id of ['sale:42', 'return:42', 'sale:9007199254740993'])
    expect(screen.getByRole('columnheader', { name: `${caption} [${id}] / Прибуток / Продажі` })).toBeTruthy()
  expect(view.container.querySelectorAll('td[title="Клітинка відсутня"]')).toHaveLength(2)
  expect(screen.getByRole('cell', { name: '∅' })).toBeTruthy()
})
