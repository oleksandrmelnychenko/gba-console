import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientProductMovementDocument } from '../types'
import { ClientProductMovementPage } from './ClientProductMovementPage'

const mocks = vi.hoisted(() => ({
  exportClientProductMovementDocument: vi.fn(),
  getClientProductMovementOrganizations: vi.fn(),
  getClientProductMovements: vi.fn(),
  searchClientProductMovementClients: vi.fn(),
  t: (key: string) => key,
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mocks.t }),
}))

vi.mock('../api/clientProductMovementApi', () => ({
  CLIENT_SEARCH_PAGE_SIZE: 20,
  exportClientProductMovementDocument: mocks.exportClientProductMovementDocument,
  getClientProductMovementOrganizations: mocks.getClientProductMovementOrganizations,
  getClientProductMovements: mocks.getClientProductMovements,
  searchClientProductMovementClients: mocks.searchClientProductMovementClients,
}))

vi.mock('../../products/components/ProductCardModal', () => ({
  ProductCardModal: () => null,
}))

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>()
  const { createElement } = await import('react')

  return {
    ...actual,
    Select: ({ label, onChange }: { label?: string; onChange?: (value: string | null) => void }) =>
      createElement('input', {
        'aria-label': label,
        onChange: (event: { currentTarget: { value: string } }) => onChange?.(event.currentTarget.value || null),
      }),
  }
})

type MockColumn = {
  id: string
  header: string
  cell?: (row: never) => ReactNode
}

vi.mock('../../../shared/ui/data-table/DataTable', () => ({
  DataTable: ({
    columns,
    data,
    emptyText,
    renderExpandedRow,
    tableId,
  }: {
    columns: MockColumn[]
    data: unknown[]
    emptyText: string
    renderExpandedRow?: (row: never) => ReactNode
    tableId: string
  }) => (
    <div data-testid={tableId}>
      {data.length === 0 && emptyText}
      {data.map((row, rowIndex) => (
        <div key={rowIndex}>
          {columns.map((column) => (
            <div key={column.id} data-testid={`${tableId}:${column.id}`}>
              <span>{column.header}</span>
              {column.cell?.(row as never)}
            </div>
          ))}
          {renderExpandedRow?.(row as never)}
        </div>
      ))}
    </div>
  ),
}))

const uahDocument: ClientProductMovementDocument = {
  DocumentCurrencyCode: 'UAH',
  DocumentId: 2080189,
  DocumentNumber: 'КНо00001249',
  DocumentTypeName: 'Накладна',
  InfoItems: [
    {
      ItemQty: 2,
      LocalPricePerItem: 457.32,
      LocalTotalAmount: 914.64,
      PricePerItem: 9.32354740061162,
      Product: { Name: 'Фільтр масляний двигуна', NetUid: 'product-1', VendorCode: 'CS1621-SF' },
      TotalAmount: 18.6471,
    },
  ],
  TotalEuroAmount: 18.6471,
  TotalLocalAmount: 914.64,
  TotalPositions: 1,
  TotalQty: 2,
  TotalRowsQty: 1,
}

function renderWithClient() {
  render(
    <MantineProvider>
      <ClientProductMovementPage />
    </MantineProvider>,
  )

  fireEvent.change(screen.getByLabelText('Клієнт'), { target: { value: 'client-1' } })
}

function cellText(testId: string): string {
  return screen.getByTestId(testId).textContent ?? ''
}

describe('ClientProductMovementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getClientProductMovementOrganizations.mockResolvedValue([])
    mocks.searchClientProductMovementClients.mockResolvedValue([])
    mocks.getClientProductMovements.mockResolvedValue([uahDocument])
  })

  it('shows the document total in its own currency next to the EUR reference', async () => {
    renderWithClient()

    expect(await screen.findByText('КНо00001249')).toBeTruthy()
    expect(mocks.getClientProductMovements).toHaveBeenCalledWith(expect.objectContaining({ clientNetId: 'client-1' }))
    expect(cellText('client-product-movement:localAmount')).toBe('Сума914,64UAH')
    expect(cellText('client-product-movement:euroAmount')).toBe('Сума EUR18,65EUR')
    expect(cellText('client-product-movement:qty')).toBe('К-сть2')
  })

  it('shows the line unit price and total in the document currency before the EUR columns', async () => {
    renderWithClient()

    const items = await screen.findByTestId('client-product-movement-items-2080189')
    const headers = Array.from(items.querySelectorAll('[data-testid] > span:first-child')).map((header) => header.textContent)

    expect(headers.slice(-5)).toEqual(['К-сть', 'Ціна за од.', 'Сума', 'Ціна за од., EUR', 'Сума EUR'])
    expect(within(items).getByTestId('client-product-movement-items-2080189:localPricePerItem').textContent).toBe('Ціна за од.457,32UAH')
    expect(within(items).getByTestId('client-product-movement-items-2080189:localAmount').textContent).toBe('Сума914,64UAH')
    expect(within(items).getByTestId('client-product-movement-items-2080189:euroPricePerItem').textContent).toBe('Ціна за од., EUR9,32EUR')
    expect(within(items).getByTestId('client-product-movement-items-2080189:euroAmount').textContent).toBe('Сума EUR18,65EUR')
  })

  it('leaves the document-currency cells empty when the server has no rate for them', async () => {
    mocks.getClientProductMovements.mockResolvedValueOnce([
      {
        ...uahDocument,
        InfoItems: [{ ...uahDocument.InfoItems![0], LocalPricePerItem: null, LocalTotalAmount: null }],
        TotalLocalAmount: null,
      },
    ])

    renderWithClient()

    expect(await screen.findByText('КНо00001249')).toBeTruthy()
    expect(cellText('client-product-movement:localAmount')).toBe('Сума')
    expect(cellText('client-product-movement:euroAmount')).toBe('Сума EUR18,65EUR')
    expect(cellText('client-product-movement-items-2080189:localAmount')).toBe('Сума')
    expect(cellText('client-product-movement-items-2080189:euroAmount')).toBe('Сума EUR18,65EUR')
  })
})
