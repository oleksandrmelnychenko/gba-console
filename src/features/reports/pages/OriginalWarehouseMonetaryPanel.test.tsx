import { MantineProvider } from '@mantine/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { readWarehouseMonetary } from '../api/originalWarehouseMonetaryApi'
import { WAREHOUSE_MONETARY_SOURCE, WAREHOUSE_MONETARY_DEFINITION, warehouseMonetaryDefaultMeasures, type WarehouseMonetaryCapability, type WarehouseMonetaryResult } from '../data/originalWarehouseMonetary'
import { OriginalWarehouseMonetaryPanel } from './OriginalWarehouseMonetaryPanel'

vi.mock('../api/originalWarehouseMonetaryApi', () => ({ readWarehouseMonetary: vi.fn() }))
const key = 'A'.repeat(32)
const capability: WarehouseMonetaryCapability = { Version: 1, World: 'fenix', SourceId: WAREHOUSE_MONETARY_SOURCE,
  DefinitionSha256: WAREHOUSE_MONETARY_DEFINITION, ModuleSha256: 'e5b629dd087052bf882091c962cf994a8fea720146e501d5b3aa3640fabcdc4b',
  QuerySha256: 'e64d3dee516b4eae8c2065f1a89779a6bb35193e48e02661c955c6398355065c', Executable: true, Title: 'Відомість',
  PeriodRequired: true, MaximumInclusiveDays: 366, RequiresCompleteNormalInputs: true, CurrentWarehouseCaptionChoicesSupported: true,
  MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption', ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false,
  DefaultMeasures: warehouseMonetaryDefaultMeasures, NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
const quantity = { Opening: '2.000', Incoming: '0.000', Outgoing: '0.000', Closing: '2.000' }
const resources = { Quantity: quantity, Cost: { Opening: '10.01', Incoming: '0.00', Outgoing: '0.00', Closing: '10.01' },
  Vat: { Opening: '2.00', Incoming: '0.00', Outgoing: '0.00', Closing: '2.00' } }
const response = (): WarehouseMonetaryResult => ({ Version: 1, World: 'fenix', SourceId: WAREHOUSE_MONETARY_SOURCE,
  DefinitionSha256: WAREHOUSE_MONETARY_DEFINITION, From: '2026-09-01', Through: '2026-09-30', Available: true,
  Code: 'original_warehouse_monetary_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
  InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Product: 'B'.repeat(32), Caption: 'Товар', CaptionAvailable: true,
    Resources: resources, Receipts: [{ Receipt: { Type: '08', Table: '00000115', Reference: 'C'.repeat(32) }, Caption: 'Назва документа недоступна', CaptionAvailable: false, Resources: resources }] }],
  Totals: resources, ProductChoices: [], WarehouseChoices: [{ Key: key, Caption: 'Наш склад' }], MissingCaptionMappings: ['Receipt'], FilterSummary: [],
  WarehouseCaptionPolicy: 'CurrentOURStorageNameViaAuthenticatedRoutingAssociation', WarehouseCaptionWitnessSha256: 'c'.repeat(64),
  WarehouseFilterAvailable: true, ReceiptFilterAvailable: false, UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion',
  MoneyUnitPolicy: 'NativeManagementResourceNoCurrencyIdentityAssumption', ManagementCurrencyPresentationVerified: false, AppliesFxConversion: false,
  NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false })
const panel = (caller = 'caller1', cap = capability) => <MantineProvider env="test"><I18nProvider><OriginalWarehouseMonetaryPanel capability={cap}
  callerKey={caller} canGenerate initialFrom="2026-09-01" initialThrough="2026-09-30" /></I18nProvider></MantineProvider>

it('monetary form offers only admitted human warehouse choices and sends their exact original equality key', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseMonetary).mockResolvedValue(response())
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Склади' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Склади' })); fireEvent.click(await screen.findByRole('option', { name: 'Наш склад' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readWarehouseMonetary).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readWarehouseMonetary).mock.calls[1][0]).toMatchObject({ CurrentWarehouseCaptionChoices: true, Warehouses: [key], Receipts: [] })
  expect(screen.queryByText(key)).toBeNull()
})
it('a late monetary response from the previous caller cannot restore rows warehouse choices or export availability', async () => {
  vi.clearAllMocks()
  let finish!: (value: WarehouseMonetaryResult) => void
  vi.mocked(readWarehouseMonetary).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readWarehouseMonetary).toHaveBeenCalledTimes(1))
  const signal = vi.mocked(readWarehouseMonetary).mock.calls[0][1]
  view.rerender(panel('caller2')); expect(signal?.aborted).toBe(true)
  await act(async () => { finish(response()) })
  expect(screen.queryByText('Наш склад')).toBeNull(); expect(screen.queryByText('Товар')).toBeNull()
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('combobox', { name: 'Склади' }) as HTMLInputElement).disabled).toBe(true)
})
it('missing complete monthly publication shows its dependency and keeps every export unavailable', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseMonetary).mockResolvedValue({ ...response(), Available: false,
    Code: 'original_warehouse_month_publication_unavailable', NormalInputsComplete: false, OurSnapshotVerified: false,
    InputWitnessSha256: null, ResultSha256: null, Rows: [], Totals: null, ProductChoices: [], WarehouseChoices: [],
    WarehouseFilterAvailable: false, WarehouseCaptionPolicy: undefined, WarehouseCaptionWitnessSha256: undefined })
  render(panel()); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await screen.findByText('Не всі місячні рухи цього періоду синхронізовані повністю.')
  for (const name of ['CSV', 'XLSX', 'PDF']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('2.000')).toBeNull(); expect(screen.queryByText('Наш склад')).toBeNull()
})
