import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import { GOODS_KIND_ID, unmappedProductClassificationError } from '../data/nativeExactFilters'
import type { ReportDataset } from '../types'
import { DayProfitControls } from './ProfitWorkbookControls'

const serviceDataset: ReportDataset = { ...profitDayDataset, productServiceFilter: { Version: 1, IsServiceValues: [false, true],
  GoodsKind: 'Товар', Basis: 'GbaProductClassification' } }
const otherGoodsKind = { Version: 1, SourceWorld: 0, ProductKindId: '8AB2005056C0000811DF05C7D73CB155', IsService: false }

function show(productClassification: unknown) {
  const setProductClassification = vi.fn(), setProductServiceFilter = vi.fn()
  render(<MantineProvider env="test"><I18nProvider>
    <DayProfitControls part="filters" dataset={serviceDataset} disabled={false} hideRegister profitReadMode={0} dayOrganizationBasis={0}
      productClassification={productClassification} productServiceFilter={undefined} sourceOrganizations={undefined} sourceBuyerSubtree={undefined}
      setProfitReadMode={vi.fn()} setDayOrganizationBasis={vi.fn()} setProductClassification={setProductClassification}
      setProductServiceFilter={setProductServiceFilter} setSourceOrganizations={vi.fn()} setSourceBuyerSubtree={vi.fn()} />
  </I18nProvider></MantineProvider>)
  return { setProductClassification, setProductServiceFilter }
}

it('states which 1C kind would be dropped and removes it only on an explicit click', () => {
  const { setProductClassification, setProductServiceFilter } = show(otherGoodsKind)
  expect(screen.getByText(unmappedProductClassificationError(otherGoodsKind))).toBeTruthy()
  expect(screen.queryByRole('checkbox', { name: 'Товар без послуг' })).toBeNull()
  expect(setProductClassification).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Вилучити відбір виду товару 1С' }))
  expect(setProductClassification).toHaveBeenCalledExactlyOnceWith(undefined)
  expect(setProductServiceFilter).not.toHaveBeenCalled()
})

it('offers the equivalent GBA filter for a mappable kind that is still in the form', () => {
  const { setProductClassification, setProductServiceFilter } = show({ ...otherGoodsKind, ProductKindId: GOODS_KIND_ID })
  fireEvent.click(screen.getByRole('button', { name: 'Замінити на «Товар без послуг»' }))
  expect(setProductServiceFilter).toHaveBeenCalledExactlyOnceWith({ Version: 1, IsService: false })
  expect(setProductClassification).toHaveBeenCalledExactlyOnceWith(undefined)
})
