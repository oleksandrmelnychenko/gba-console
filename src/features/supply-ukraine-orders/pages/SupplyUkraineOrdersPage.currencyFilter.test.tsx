import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { buildSupplyOrderCurrencyFilterOptions } from '../currencyFilter'
import type { SupplyUkraineOrdersFilter } from '../types'
import { OrdersFilterToolbar } from './SupplyUkraineOrdersPage'

vi.mock('../../../shared/ui/paginator/Paginator', () => ({
  Paginator: () => <div data-testid="orders-paginator" />,
}))

const FILTERS: SupplyUkraineOrdersFilter = {
  currencyId: '',
  from: '2026-08-05',
  supplier: '',
  to: '2026-08-12',
  type: 'all',
}

describe('Ukraine orders currency filter', () => {
  it('uses the numeric API identity when a currency also has a NetUid', () => {
    expect(buildSupplyOrderCurrencyFilterOptions([
      {
        Code: 'USD',
        Id: 2,
        Name: 'Долар США',
        NetUid: 'b196c411-99e5-41ae-92d2-c1f7ba94eb03',
      },
    ])).toEqual([
      { label: 'Долар США - USD', value: '2' },
    ])
  })

  it('applies the selected currency immediately instead of leaving it in the draft', () => {
    const onApplyFilterPatch = vi.fn()
    const onFilterDraftChange = vi.fn()
    const currencyOptions = buildSupplyOrderCurrencyFilterOptions([
      {
        Code: 'USD',
        Id: 2,
        Name: 'Долар США',
        NetUid: 'b196c411-99e5-41ae-92d2-c1f7ba94eb03',
      },
    ])

    render(
      <MantineProvider>
        <I18nProvider>
          <OrdersFilterToolbar
            canPrint={false}
            createPermissions={{ canCreateDirect: false, canCreateToUkraine: false }}
            currencyOptions={currencyOptions}
            filterDraft={FILTERS}
            isDownloading={false}
            isLoading={false}
            page={1}
            pageSize={20}
            totalPages={1}
            onApplyFilterPatch={onApplyFilterPatch}
            onApplyType={() => undefined}
            onChangePage={() => undefined}
            onChangePageSize={() => undefined}
            onCreateDirect={() => undefined}
            onCreateToUkraine={() => undefined}
            onDownload={() => undefined}
            onFilterDraftChange={onFilterDraftChange}
            onRefresh={() => undefined}
            onResetFilters={() => undefined}
            onTableToolbarSlotMount={() => undefined}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Валюта' }))
    fireEvent.click(screen.getByRole('option', { name: 'Долар США - USD' }))

    expect(onApplyFilterPatch).toHaveBeenCalledWith({ currencyId: '2' })
    expect(onFilterDraftChange).not.toHaveBeenCalled()
  })
})
