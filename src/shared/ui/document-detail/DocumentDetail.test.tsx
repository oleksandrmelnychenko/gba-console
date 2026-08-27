import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithMantine } from '../../../test/renderWithMantine'
import {
  DocumentDetailFlag,
  DocumentDetailLayout,
  DocumentDetailMetric,
  DocumentDetailRow,
  DocumentDetailSection,
  DocumentDetailSummary,
} from './DocumentDetail'

describe('DocumentDetail', () => {
  it('composes the shared summary, actions and full-width table section', () => {
    const onExport = vi.fn()
    const { container } = renderWithMantine(
      <DocumentDetailLayout
        actions={<button onClick={onExport}>Export</button>}
        summary={
          <DocumentDetailSummary
            eyebrow="Document"
            title="123"
            meta="27.08.26"
            metrics={<DocumentDetailMetric label="Amount" suffix="EUR" tone="danger" value="25,00" />}
          />
        }
      >
        <DocumentDetailSection stacked subtitle="1" title="Items">
          <table><tbody><tr><td>Product</td></tr></tbody></table>
        </DocumentDetailSection>
      </DocumentDetailLayout>,
    )

    expect(screen.getByRole('region', { name: 'Items' }).querySelector('.is-stacked')).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(container.querySelector('.document-detail-metric.is-danger strong')?.textContent).toBe('25,00EUR')
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(onExport).toHaveBeenCalledOnce()
  })

  it('preserves zero values, wide rows and the outgoing-order empty placeholder', () => {
    const { container } = renderWithMantine(
      <DocumentDetailSection title="Amounts">
        <DocumentDetailRow label="Zero" mono value={0} wide />
        <DocumentDetailRow label="Empty" value="" />
        <DocumentDetailRow label="Missing" />
        <DocumentDetailFlag active label="Active" />
      </DocumentDetailSection>,
    )

    expect(container.querySelector('.document-detail-row.is-wide .app-money')?.textContent?.trim()).toBe('0')
    expect(screen.getAllByText('-')).toHaveLength(2)
    expect(screen.getByText('Active').classList.contains('is-active')).toBe(true)
  })
})
