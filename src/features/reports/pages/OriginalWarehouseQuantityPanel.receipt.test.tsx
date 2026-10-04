import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  PeriodRequired: true, MaximumInclusiveDays: 366, RequiresCompleteNormalInputs: true, CurrentWarehouseCaptionChoicesSupported: true, CurrentReceiptCaptionChoicesSupported: true,
  NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
const quantity = { Opening: '2.000', Incoming: '0.000', Outgoing: '0.000', Closing: '2.000' }
const response = (): WarehouseQuantityResult => ({ Version: 1, World: 'fenix', SourceId: WAREHOUSE_QUANTITY_SOURCE,
  DefinitionSha256: WAREHOUSE_QUANTITY_DEFINITION, From: '2026-09-01', Through: '2026-09-30', Available: true,
  Code: 'original_warehouse_quantity_OUR_complete', NormalInputsComplete: true, OurSnapshotVerified: true,
  InputWitnessSha256: 'a'.repeat(64), ResultSha256: 'b'.repeat(64), Rows: [{ Product: 'B'.repeat(32), Caption: 'Товар', CaptionAvailable: true,
    Quantity: quantity, Receipts: [{ Receipt: { Type: '08', Table: '00000115', Reference: 'C'.repeat(32) }, Caption: 'Назва документа недоступна', CaptionAvailable: false, Quantity: quantity }] }],
  Totals: quantity, ProductChoices: [{ Key: 'B'.repeat(32), Caption: 'Товар' }], WarehouseChoices: [{ Key: key, Caption: 'Наш склад' }], MissingCaptionMappings: ['Receipt'], FilterSummary: [],
  WarehouseCaptionPolicy: 'CurrentOURStorageNameViaAuthenticatedRoutingAssociation', WarehouseCaptionWitnessSha256: 'c'.repeat(64),
  WarehouseFilterAvailable: true, ReceiptFilterAvailable: false, UnitPolicy: 'NativeStoredQuantityNoCoefficientConversion',
  NativeVirtualTableVerified: false, SourceParityVerified: false, OriginalFullTaskAccepted: false })
const panel = (caller = 'caller1', cap = capability) => <MantineProvider env="test"><I18nProvider><OriginalWarehouseQuantityPanel capability={cap}
  callerKey={caller} canGenerate initialFrom="2026-09-01" initialThrough="2026-09-30" /></I18nProvider></MantineProvider>

const captionResponse = (): WarehouseQuantityResult => {
  const value = response(), receipt = value.Rows[0].Receipts[0].Receipt
  value.Rows[0].Receipts[0].Caption = 'Н-15 від 10.09.2026'; value.Rows[0].Receipts[0].CaptionAvailable = true
  value.ReceiptFilterAvailable = true
  value.ReceiptCaptions = { Policy: 'CurrentOURAuthenticatedInboundHeaderSameNormalSourceGeneration', NormalSourceGenerationBound: true, CompleteReceiptChoices: true,
    Code: 'original_warehouse_receipt_selected_scope_complete', Choices: [{ Receipt: { ...receipt }, Caption: 'Н-15 від 10.09.2026' }], WitnessSha256: 'd'.repeat(64),
    AllElevenReceiptKindsAvailable: false, HistoricalCaptionVerified: false, SourceParityVerified: false }
  return value
}
it('keeps receipt mode off by default and only sends it after explicit user choice', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseQuantity).mockImplementation(async request => request.CurrentReceiptCaptionChoices ? captionResponse() : response())
  render(panel()); const checkbox = screen.getByRole('checkbox', { name: 'Поточні підписи документів GBA' }) as HTMLInputElement
  expect(checkbox.checked).toBe(false); expect(screen.queryByRole('combobox', { name: 'Документи надходження' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(false))
  expect(vi.mocked(readWarehouseQuantity).mock.calls[0][0]).not.toHaveProperty('CurrentReceiptCaptionChoices')
  fireEvent.click(checkbox); expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(false))
  expect(vi.mocked(readWarehouseQuantity).mock.calls[1][0].CurrentReceiptCaptionChoices).toBe(true)
})
it('selects the human caption with its full tuple and drops receipt proof when products change', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseQuantity).mockResolvedValue(captionResponse())
  render(panel()); fireEvent.click(screen.getByRole('checkbox', { name: 'Поточні підписи документів GBA' })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('combobox', { name: 'Документи надходження' })); fireEvent.click(await screen.findByRole('option', { name: 'Н-15 від 10.09.2026' }))
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readWarehouseQuantity).toHaveBeenCalledTimes(2))
  expect(vi.mocked(readWarehouseQuantity).mock.calls[1][0].Receipts).toEqual([{ Type: '08', Table: '00000115', Reference: 'C'.repeat(32) }])
  fireEvent.click(screen.getByRole('combobox', { name: 'Товари' })); fireEvent.click(await screen.findByRole('option', { name: 'Товар' }))
  expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readWarehouseQuantity).toHaveBeenCalledTimes(3))
  expect(vi.mocked(readWarehouseQuantity).mock.calls[2][0]).toMatchObject({ Products: ['B'.repeat(32)], Receipts: [] })
  expect(screen.queryByText('C'.repeat(32))).toBeNull()
})
it('partial three-kind captions leave all rows and exports usable but never enable an incomplete document chooser', async () => {
  vi.clearAllMocks(); const value = captionResponse(); value.ReceiptFilterAvailable = false
  value.ReceiptCaptions!.CompleteReceiptChoices = false; value.ReceiptCaptions!.Code = 'original_warehouse_receipt_selected_scope_incomplete'
  value.Rows[0].Receipts.push({ Receipt: { Type: '08', Table: '0000011C', Reference: 'D'.repeat(32) }, Caption: 'Назва документа недоступна', CaptionAvailable: false,
    Quantity: { Opening: '0.000', Incoming: '0.000', Outgoing: '0.000', Closing: '0.000' } })
  vi.mocked(readWarehouseQuantity).mockResolvedValue(value)
  render(panel()); fireEvent.click(screen.getByRole('checkbox', { name: 'Поточні підписи документів GBA' })); fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'XLSX' }) as HTMLButtonElement).disabled).toBe(false))
  expect((screen.getByRole('combobox', { name: 'Документи надходження' }) as HTMLInputElement).disabled).toBe(true)
  expect(screen.getAllByText('Н-15 від 10.09.2026').length).toBeGreaterThan(0); expect(screen.getAllByText('2.000').length).toBeGreaterThan(0)
})
it('an older server never exposes or sends the unadvertised receipt mode', async () => {
  vi.clearAllMocks(); vi.mocked(readWarehouseQuantity).mockResolvedValue(response())
  render(panel('caller1', { ...capability, CurrentReceiptCaptionChoicesSupported: undefined }))
  expect(screen.queryByRole('checkbox', { name: 'Поточні підписи документів GBA' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Сформувати' }))
  await waitFor(() => expect(readWarehouseQuantity).toHaveBeenCalledTimes(1))
  expect(vi.mocked(readWarehouseQuantity).mock.calls[0][0]).not.toHaveProperty('CurrentReceiptCaptionChoices')
})
