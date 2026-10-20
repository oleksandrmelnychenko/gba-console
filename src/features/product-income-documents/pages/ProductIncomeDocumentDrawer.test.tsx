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
    canExport: true,
    canOpenRemainings: true,
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
    expect(summary.querySelectorAll('.document-detail-metric')).toHaveLength(1)
    expect(summary.textContent).toContain('Кількість: 1')
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
    fireEvent.click(within(dialog).getByRole('button', { name: 'Залишки за партіями' }))
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
    const remainingSection = screen.getByRole('region', { name: 'Залишки за партіями' })
    const table = within(remainingSection).getByTestId('product-income-document-remainings')
    expect(table.textContent).toBe('1')
    expect(table.getAttribute('data-layout')).toBe('product-income-document-remainings-2')
    expect(table.getAttribute('aria-busy')).toBe('true')
    expect(within(remainingSection).getByText('Помилка залишків')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Позиції документа' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Прихідна накладна (Оприходування)' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Залишки за партіями' }).hasAttribute('disabled')).toBe(true)
  })

  it.each([
    ['Прихідна накладна (акт звірки)', { ActReconciliationItem: { Product: { VendorCode: 'ACT-1' } } }, 'product-income-act-reconciliation-overview'],
    ['Товари повернення', { SaleReturnItem: { SaleReturn: { Number: 'RETURN-1' }, Qty: 1 } }, 'product-income-sale-return-items'],
  ] as const)('applies the same section pattern to %s', async (title, item, tableId) => {
    renderDrawer({ document: { ...capitalizationDocument, ProductIncomeItems: [item] } })
    await screen.findByRole('dialog', { name: 'Документ приходу' })
    const section = screen.getByRole('region', { name: title })
    expect(section.querySelector('.document-detail-section__body.is-stacked')).toBeTruthy()
    expect(within(section).getByTestId(tableId).textContent).toBe('1')
  })

  it('shows the same EUR return total in the header and footer despite stale document totals', async () => {
    renderDrawer({ document: {
      Number: 'RETURN-395',
      TotalNetPrice: 9999,
      TotalQty: 100,
      Currency: { Code: 'UAH' },
      ProductIncomeItems: [
        { Qty: 50, SaleReturnItem: { Amount: 50.34, AmountLocal: 0, Qty: 1, SaleReturn: { Number: 'RETURN-395' } } },
        { Qty: 50, SaleReturnItem: { Amount: 6.13, AmountLocal: 0, Qty: 2 } },
        { Deleted: true, SaleReturnItem: { Amount: 900, Qty: 90 } },
      ],
    } })
    const dialog = await screen.findByRole('dialog', { name: 'Документ приходу' })
    const summary = dialog.querySelector('.document-detail-summary')!
    const overview = within(dialog).getByRole('region', { name: 'Товари повернення' })
    const footer = overview.querySelector('.income-return-totals')!
    expect(summary.textContent).toContain('Сума повернення')
    expect(summary.textContent?.replace(/\s/g, '')).toContain('56,47EUR')
    expect(footer.textContent?.replace(/\s/g, '')).toContain('56,47EUR')
    expect(footer.textContent?.replace(/\s/g, '')).toContain('Всякількість3')
    expect(within(overview).getByTestId('product-income-sale-return-items').textContent).toBe('2')
    expect(summary.textContent).not.toContain('9999')
  })

  it('sums only active return-line VAT and ignores stale document VAT totals', async () => {
    renderDrawer({ document: {
      Number: 'RETURN-VAT',
      TotalVatAmount: 9999,
      ProductIncomeItems: [
        { SaleReturnItem: {
          Amount: 60.66, Qty: 2, VatAmount: 10.11, SaleReturn: { Number: 'RETURN-VAT' },
          OrderItem: { Order: { Sale: { ClientAgreement: { Agreement: { WithVATAccounting: true } } } } },
        } },
        { SaleReturnItem: { Amount: 13.32, Qty: 1, VatAmount: 2.22 } },
        { Deleted: true, SaleReturnItem: { Amount: 600, Qty: 10, VatAmount: 100 } },
        { Qty: 50 },
      ],
    } })
    await screen.findByRole('dialog', { name: 'Документ приходу' })
    const overview = screen.getByRole('region', { name: 'Товари повернення' })
    const vatRow = within(overview).getByText('ПДВ').closest('.document-detail-row')!
    expect(vatRow.querySelector('.document-detail-row__value')?.textContent).toBe('12,33')
    expect(vatRow.textContent).not.toContain('9999')
    expect(within(overview).getByTestId('product-income-sale-return-items').textContent).toBe('2')
  })

  it.each([
    ['all VAT values are missing', [undefined, undefined], '—'],
    ['one VAT value is missing', [3.5, undefined], '—'],
    ['one VAT value is NaN', [3.5, Number.NaN], '—'],
    ['one VAT value is infinite', [3.5, Number.POSITIVE_INFINITY], '—'],
    ['every VAT value is a real zero', [0, 0], '0,00'],
  ] as const)('distinguishes unknown return VAT from zero when %s', async (_description, vatAmounts, expected) => {
    renderDrawer({ document: {
      Number: 'RETURN-VAT',
      TotalVatAmount: 1234,
      ProductIncomeItems: vatAmounts.map(VatAmount => ({
        SaleReturnItem: {
          Amount: 10, Qty: 1, VatAmount, SaleReturn: { Number: 'RETURN-VAT' },
          OrderItem: { Order: { Sale: { ClientAgreement: { Agreement: { WithVATAccounting: true } } } } },
        },
      })),
    } })
    await screen.findByRole('dialog', { name: 'Документ приходу' })
    const overview = screen.getByRole('region', { name: 'Товари повернення' })
    const vatRow = within(overview).getByText('ПДВ').closest('.document-detail-row')!
    expect(vatRow.querySelector('.document-detail-row__value')?.textContent).toBe(expected)
  })

  it('handles a document without source data or a network identifier', async () => {
    renderDrawer({ document: { Number: 'EMPTY', TotalQty: 0, ProductIncomeItems: [] } })
    await screen.findByRole('dialog', { name: 'Документ приходу' })
    expect(screen.queryByRole('link', { name: 'Джерело' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Експорт' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Залишки за партіями' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('product-income-document-items').textContent).toBe('0')
  })
})
