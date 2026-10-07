import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { getWarehouseQuantityCapability } from '../api/originalWarehouseQuantityApi'
import { WAREHOUSE_QUANTITY_DEFINITION, WAREHOUSE_QUANTITY_SOURCE, type WarehouseQuantityCapability } from '../data/originalWarehouseQuantity'
import type { ReportCatalogueEntry } from '../types'
import { OriginalWarehouseQuantityCatalogueLaunch } from './OriginalWarehouseQuantityCatalogueLaunch'
vi.mock('../api/originalWarehouseQuantityApi', () => ({ getWarehouseQuantityCapability: vi.fn() }))
const capability: WarehouseQuantityCapability = { Version: 1, World: 'fenix', SourceId: WAREHOUSE_QUANTITY_SOURCE, DefinitionSha256: WAREHOUSE_QUANTITY_DEFINITION,
  ModuleSha256: '29bcf58a1951a39cbb6cda7195c7a2da100edb98a2b1b44e2406af5ed5876719', QuerySha256: 'ea18073fc8b3fe0f39652a077391038003f6f0617357d749ec9b4f89da479785',
  Title: 'Відомість', Executable: true, PeriodRequired: true, MaximumInclusiveDays: 366, RequiresCompleteNormalInputs: true,
  NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
const report = { Id: 'builtin:ВедомостьПартииТоваровНаСкладахКоличественныйУчет', Sources: [{ World: 'fenix', SourceId: WAREHOUSE_QUANTITY_SOURCE }] } as ReportCatalogueEntry
const component = (enabled = true, worlds = ['fenix'], callerKey = 'first') => <MantineProvider env="test"><I18nProvider>
  <OriginalWarehouseQuantityCatalogueLaunch report={report} worlds={worlds} enabled={enabled} disabled={false} callerKey={callerKey} />
</I18nProvider></MantineProvider>
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getWarehouseQuantityCapability).mockResolvedValue(capability) })
it('does not request or open quantity-period delivery without report generation permission', () => {
  render(component(false)); expect(getWarehouseQuantityCapability).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: 'Fenix · Кількість за період' }) as HTMLButtonElement).disabled).toBe(true)
})
it('does not offer a Fenix period alias when only AMG is visible', () => {
  render(component(true, ['amg'])); expect(getWarehouseQuantityCapability).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Fenix · Кількість за період' })).toBeNull()
})
it('ignores a late capability from the previous caller until the new caller request settles', async () => {
  let first!: (capability: WarehouseQuantityCapability) => void, second!: (capability: WarehouseQuantityCapability) => void
  vi.mocked(getWarehouseQuantityCapability).mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve }))
  const view = render(component()); await waitFor(() => expect(getWarehouseQuantityCapability).toHaveBeenCalledTimes(1))
  view.rerender(component(true, ['fenix'], 'second')); await waitFor(() => expect(getWarehouseQuantityCapability).toHaveBeenCalledTimes(2))
  await act(async () => { first(capability) })
  expect((screen.getByRole('button', { name: 'Fenix · Кількість за період' }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { second(capability) })
  expect((screen.getByRole('button', { name: 'Fenix · Кількість за період' }) as HTMLButtonElement).disabled).toBe(false)
})

it('retries a failed capability check with a fresh attempt and keeps the launch disabled until it settles', async () => {
  let retry!: (value: WarehouseQuantityCapability) => void
  vi.mocked(getWarehouseQuantityCapability).mockRejectedValueOnce(new Error('unavailable'))
    .mockImplementationOnce(() => new Promise(resolve => { retry = resolve }))
  render(component())
  await screen.findByText('Не вдалося перевірити періодну відомість.')
  expect((screen.getByRole('button', { name: 'Fenix · Кількість за період' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Повторити' }))
  await waitFor(() => expect(getWarehouseQuantityCapability).toHaveBeenCalledTimes(2))
  expect((screen.getByRole('button', { name: 'Fenix · Кількість за період' }) as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { retry(capability) })
  expect((screen.getByRole('button', { name: 'Fenix · Кількість за період' }) as HTMLButtonElement).disabled).toBe(false)
})
