import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readWarehouseQuantity } from '../api/originalWarehouseQuantityApi'
import { WAREHOUSE_QUANTITY_SOURCE, WAREHOUSE_QUANTITY_DEFINITION, type WarehouseQuantityCapability, type WarehouseQuantityResult } from '../data/originalWarehouseQuantity'
import { OriginalWarehouseQuantityPanel } from './OriginalWarehouseQuantityPanel'

vi.mock('../api/originalWarehouseQuantityApi', () => ({ readWarehouseQuantity: vi.fn() }))
const key = 'A'.repeat(32)
const capability: WarehouseQuantityCapability = { Version: 1, World: 'fenix', SourceId: WAREHOUSE_QUANTITY_SOURCE,
  DefinitionSha256: WAREHOUSE_QUANTITY_DEFINITION, ModuleSha256: '29bcf58a1951a39cbb6cda7195c7a2da100edb98a2b1b44e2406af5ed5876719',
  QuerySha256: 'ea18073fc8b3fe0f39652a077391038003f6f0617357d749ec9b4f89da479785', Executable: true, Title: 'Відомість',
  PeriodRequired: true, MaximumInclusiveDays: 366, RequiresCompleteNormalInputs: true, CurrentWarehouseCaptionChoicesSupported: true,
  NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
const quantity = { Opening: '2.000', Incoming: '0.000', Outgoing: '0.000', Closing: '2.000' }
const response = (): WarehouseQuantityResult => ({ Version: 1, World: 'fenix', SourceId: WAREHOUSE_QUANTITY_SOURCE,
  DefinitionSha256: WAREHOUSE_QUANTITY_DEFINITION, From: '2026-09-01', Through: '2026-09-30', Available: true,
  Code: 'original_warehouse_quantity_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
  InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Product: 'B'.repeat(32), Caption: 'Товар', CaptionAvailable: true,
    Quantity: quantity, Receipts: [{ Receipt: { Type: '08', Table: '00000115', Reference: 'C'.repeat(32) }, Caption: 'Назва документа недоступна', CaptionAvailable: false, Quantity: quantity }] }],
  Totals: quantity, ProductChoices: [], WarehouseChoices: [{ Key: key, Caption: 'Наш склад' }], MissingCaptionMappings: ['Receipt'], FilterSummary: [],
  WarehouseCaptionPolicy: 'CurrentOURStorageNameViaAuthenticatedRoutingAssociation', WarehouseCaptionWitnessSha256: 'c'.repeat(64),
  WarehouseFilterAvailable: true, ReceiptFilterAvailable: false, UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion',
  NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false })
const panel = (caller = 'caller1', cap = capability) => <MantineProvider env="test"><I18nProvider><OriginalWarehouseQuantityPanel capability={cap}
  callerKey={caller} canGenerate initialFrom="2026-09-01" initialThrough="2026-09-30" /></I18nProvider></MantineProvider>

it('offers only admitted human warehouse choices and sends their exact original equality key', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseQuantity).mockResolvedValue(response())
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Склади' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Склади' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш склад' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readWarehouseQuantity).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readWarehouseQuantity).mock.calls[1][0]).toMatchObject({ CurrentWarehouseCaptionChoices: true, Warehouses: [key], Receipts: [] })
  expect(screen.queryByText(key)).toBeNull()
})
it('current mapping absence leaves complete quantities and exports available without invented warehouse names', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseQuantity).mockResolvedValue({ ...response(), WarehouseChoices: [], WarehouseFilterAvailable: false, WarehouseCaptionWitnessSha256: undefined })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(false))
  expect((screen.getByRole('combobox', { name: 'Склади' }) as HTMLInputElement).disabled).toBe(true)
  expect(screen.getAllByText('2.000').length).toBeGreaterThan(0)
})
it('caller change drops warehouse choices and selections without showing a raw reference or stale result', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseQuantity).mockResolvedValue(response())
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Склади' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Склади' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш склад' }))
  view.rerender(panel('caller2'))
  expect(screen.queryByText('Наш склад')).toBeNull(); expect(screen.queryByText(key)).toBeNull()
  expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readWarehouseQuantity).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readWarehouseQuantity).mock.calls[1][0].Warehouses).toEqual([])
})

it('a late quantity response from the previous caller cannot restore rows warehouse choices or export availability', async () => {
  vi.clearAllMocks()
  let finish!: (value: WarehouseQuantityResult) => void
  vi.mocked(readWarehouseQuantity).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readWarehouseQuantity).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readWarehouseQuantity).mock.calls[0][1]
  view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(response()) })
  expect(screen.queryByText('Наш склад')).toBeNull(); expect(screen.queryByText('Товар')).toBeNull()
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Склади' }) as HTMLInputElement).disabled).toBe(true)
})
it('missing complete monthly publication shows its dependency and keeps every export unavailable', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseQuantity).mockResolvedValue({ ...response(), Available: false,
    Code: 'original_warehouse_month_publication_unavailable', NormalInputsComplete: false, OurSnapshotVerified: false,
    InputWitnessSha256: null, ResultSha256: null, Rows: [], Totals: null, ProductChoices: [], WarehouseChoices: [],
    WarehouseFilterAvailable: false, WarehouseCaptionPolicy: undefined, WarehouseCaptionWitnessSha256: undefined })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Не всі місячні рухи цього періоду синхронізовані повністю.')
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('2.000')).toBeNull(); expect(screen.queryByText('Наш склад')).toBeNull()
})
