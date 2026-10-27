import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { profitDayDataset } from '../data/profitReadMode.test-fixtures'
import type { ReportDataset } from '../types'
import { DayProfitControls } from './ProfitWorkbookControls'

const serviceDataset: ReportDataset = { ...profitDayDataset, productServiceFilter: { Version: 1, IsServiceValues: [false, true],
  GoodsKind: 'Товар', Basis: 'GbaProductClassification' } }

function show(dataset: ReportDataset, productServiceFilter: unknown, setProductServiceFilter = vi.fn()) {
  render(<MantineProvider env="test"><I18nProvider>
    <DayProfitControls part="filters" dataset={dataset} disabled={false} hideRegister profitReadMode={0} dayOrganizationBasis={0}
      productServiceFilter={productServiceFilter} sourceOrganizations={undefined} sourceBuyerSubtree={undefined}
      setProfitReadMode={vi.fn()} setDayOrganizationBasis={vi.fn()} setProductServiceFilter={setProductServiceFilter}
      setSourceOrganizations={vi.fn()} setSourceBuyerSubtree={vi.fn()} />
  </I18nProvider></MantineProvider>)
  return setProductServiceFilter
}

it('toggles «Товар без послуг» from the GBA classification and flags a saved «Послуги» choice', () => {
  const set = show(serviceDataset, { Version: 1, IsService: false })
  const goods = screen.getByRole('checkbox', { name: 'Товар без послуг' }) as HTMLInputElement
  expect(goods.checked).toBe(true)
  fireEvent.click(goods)
  expect(set).toHaveBeenLastCalledWith(undefined)
})

it('turns a saved «Послуги» template into goods only on an explicit click', () => {
  const set = show(serviceDataset, { Version: 1, IsService: true })
  expect(screen.getByText(/Шаблон містить відбір «Послуги»/)).toBeTruthy()
  const goods = screen.getByRole('checkbox', { name: 'Товар без послуг' }) as HTMLInputElement
  expect(goods.checked).toBe(false)
  fireEvent.click(goods)
  expect(set).toHaveBeenLastCalledWith({ Version: 1, IsService: false })
})

it('hides the goods switch when the server does not advertise the GBA classification', () => {
  show(profitDayDataset, undefined)
  expect(screen.queryByRole('checkbox', { name: 'Товар без послуг' })).toBeNull()
})
