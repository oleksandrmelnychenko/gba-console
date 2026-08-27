import { fireEvent, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { renderWithMantine } from '../../../test/renderWithMantine'
import type { ProductIncomeDocument } from '../types'
import { ProductIncomeDocumentDrawer } from './ProductIncomeDocumentsPage'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (value: string) => value }),
}))

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({ data, isLoading, layoutVersion, tableId }: {
    data: unknown[]
    isLoading?: boolean
    layoutVersion: string
    tableId: string
  }) => (
    <div aria-busy={Boolean(isLoading)} data-layout={layoutVersion} data-testid={tableId}>
      {data.length}
    </div>
  ),
}))

const capitalizationDocument: ProductIncomeDocument = {
  NetUid: 'income-1',
  Number: 'K000001210',
  FromDate: '2026-08-10T12:00:00',
  Currency: { Code: 'EUR' },
  TotalNetPrice: 2113.29,
  TotalQty: 1,
  Storage: { Name: 'СКЛАД -3' },
  User: { Name: 'Melnychenko' },
  ProductIncomeItems: [
    {
      NetUid: 'item-1',
      Qty: 1,
      ProductCapitalizationItem: {
        ProductCapitalization: {
          NetUid: 'capitalization-1',
          Number: 'K000001210',
          FromDate: '2026-08-10T12:00:00',
          Comment: '20/08/26 Козачук Д.',
          Organization: { Name: 'Організація з довгою назвою' },
        },
      },
    },
    { NetUid: 'deleted-item', Deleted: true, Qty: 99 },
  ],
}

type DrawerProps = ComponentProps<typeof ProductIncomeDocumentDrawer>

function renderDrawer(overrides: Partial<DrawerProps> = {}) {
  const props: DrawerProps = {
    capitalization: {
      Number: 'K000001210',
      TotalAmount: 2113.29,
      ProductCapitalizationItems: [{ Qty: 1, TotalAmount: 2113.29, Weight: 2 }],
    },
    capitalizationError: null,
    capitalizationItemColumns: [],
    detailMode: 'view',
    document: capitalizationDocument,
    documentInfoError: null,
    exportingNetId: null,
    isLoadingCapitalization: false,
    isLoadingDocumentInfo: false,
    isLoadingRemainings: false,
    itemColumns: [],
    remainingColumns: [],
    remainings: [],
    remainingsError: null,
    onClose: vi.fn(),
    onExport: vi.fn(),
    onLoadRemainings: vi.fn(),
    ...overrides,
  }

  renderWithMantine(<MemoryRouter><ProductIncomeDocumentDrawer {...props} /></MemoryRouter>)
  return props
}

describe('ProductIncomeDocumentDrawer', () => {
  it('uses the shared document summary and sections without losing details or actions', async () => {
    const props = renderDrawer()
    const dialog = await screen.findByRole('dialog', { name: 'Документ приходу' })
    const summary = dialog.querySelector('.document-detail-summary')!

    expect(summary.textContent).toContain('K000001210')
    expect(summary.textContent).toContain('Прихідна накладна (Оприходування)')
    expect(summary.textContent?.replace(/\s/g, '')).toContain('2113,29EUR')
    expect(summary.textContent).toContain('Виконано')
    expect(summary.querySelectorAll('.document-detail-metric')).toHaveLength(3)
    expect(within(dialog).getByRole('region', { name: 'Документ' })).toBeTruthy()
    const participants = within(dialog).getByRole('region', { name: 'Учасники та склад' })
    expect(participants.textContent).toContain('Організація з довгою назвою')
    expect(participants.textContent).toContain('СКЛАД -3')
    expect(participants.textContent).toContain('Melnychenko')
    expect(within(dialog).getByText('20/08/26 Козачук Д.')).toBeTruthy()
    const overview = within(dialog).getByRole('region', { name: 'Прихідна накладна (Оприходування)' })
    expect(within(overview).getByTestId('product-income-capitalization-overview').textContent).toBe('1')
    const items = within(dialog).getByRole('region', { name: 'Позиції документа' })
    expect(within(items).getByTestId('product-income-document-items').textContent).toBe('1')
    expect(within(items).getByTestId('product-income-document-items').getAttribute('data-layout')).toBe('product-income-document-items-2')
    expect(within(dialog).getByRole('link', { name: 'Джерело' }).getAttribute('href')).toBe('/products/capitalization?netId=capitalization-1')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Експорт' }))
    expect(props.onExport).toHaveBeenCalledWith(capitalizationDocument)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Залишки по партіям' }))
    expect(props.onLoadRemainings).toHaveBeenCalledWith(capitalizationDocument)
  })

  it('keeps loading and error states inside the corresponding sections', async () => {
    renderDrawer({
      capitalization: null,
      capitalizationError: 'Не вдалося завантажити оприбуткування',
      documentInfoError: 'Не вдалося завантажити документ',
      isLoadingCapitalization: true,
      isLoadingDocumentInfo: true,
    })
    await screen.findByRole('dialog', { name: 'Документ приходу' })
    expect(screen.getByText('Не вдалося завантажити оприбуткування')).toBeTruthy()
    expect(screen.getByText('Не вдалося завантажити документ')).toBeTruthy()
    expect(screen.getByTestId('product-income-capitalization-overview').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByTestId('product-income-document-items').getAttribute('aria-busy')).toBe('true')
  })

  it('preserves the remainings mode, its table settings and error state', async () => {
    renderDrawer({
      detailMode: 'remainings',
      remainings: [{ NetUid: 'remaining-1' }],
      remainingsError: 'Помилка залишків',
      isLoadingRemainings: true,
    })
    await screen.findByRole('dialog', { name: 'Документ приходу' })
    const remainingSection = screen.getByRole('region', { name: 'Залишки по партіям' })
    const table = within(remainingSection).getByTestId('product-income-document-remainings')
    expect(table.textContent).toBe('1')
    expect(table.getAttribute('data-layout')).toBe('product-income-document-remainings-2')
    expect(table.getAttribute('aria-busy')).toBe('true')
    expect(within(remainingSection).getByText('Помилка залишків')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Позиції документа' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Прихідна накладна (Оприходування)' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Залишки по партіям' }).hasAttribute('disabled')).toBe(true)
  })

  it.each([
    ['Прихідна накладна (акт звірки)', { ActReconciliationItem: { Product: { VendorCode: 'ACT-1' } } }, 'product-income-act-reconciliation-overview'],
    ['Прихідна накладна (повернення)', { SaleReturnItem: { SaleReturn: { Number: 'RETURN-1' }, Qty: 1 } }, 'product-income-sale-return-items'],
  ] as const)('applies the same section pattern to %s', async (title, item, tableId) => {
    renderDrawer({ document: { ...capitalizationDocument, ProductIncomeItems: [item] } })
    await screen.findByRole('dialog', { name: 'Документ приходу' })
    const section = screen.getByRole('region', { name: title })
    expect(section.querySelector('.document-detail-section__body.is-stacked')).toBeTruthy()
    expect(within(section).getByTestId(tableId).textContent).toBe('1')
  })

  it('handles a document without source data or a network identifier', async () => {
    renderDrawer({ document: { Number: 'EMPTY', TotalQty: 0, ProductIncomeItems: [] } })
    await screen.findByRole('dialog', { name: 'Документ приходу' })
    expect(screen.queryByRole('link', { name: 'Джерело' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Експорт' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Залишки по партіям' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('product-income-document-items').textContent).toBe('0')
  })
})
