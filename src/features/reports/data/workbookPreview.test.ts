import { expect, it } from 'vitest'
import { normalizeNativeReportPreview } from './nativeReportPreview'
import { bindWorkbookPreview, workbookAttributeText } from './workbookPreview'
import { workbookPreview, presentedCashRequest } from './workbookPresentation.test-fixtures'

const normalize = (preview = workbookPreview()) => normalizeNativeReportPreview({ Preview: preview })
it('retains exact Int64 currency identity, server row hash and explicit financial NULL without JavaScript rehashing', () => {
  const raw = workbookPreview(), result = normalize(raw)
  expect(result.WorkbookPresentation?.rows[0]).toMatchObject({ rowSourceIndex: 12, rowKeySha256: 'b'.repeat(64),
    currencyWitnesses: [{ id: '9223372036854775807' }] })
  expect(result.Cells[0].Value.Value).toBeNull()
  raw.workbookPresentation.rows[0].values[0].values[0] = 'changed'
  expect(result.WorkbookPresentation?.rows[0].values[0].values).toEqual(['Гривня (UAH)'])
})
it('refuses different result hashes, unknown preview sources and wrong native row grain', () => {
  for (const mutate of [(raw: ReturnType<typeof workbookPreview>) => { raw.workbookPresentation.resultSha256 = 'f'.repeat(64) },
    (raw: ReturnType<typeof workbookPreview>) => { raw.Request.DataSource = 'NativeSupplierBatchGrossProfit' },
    (raw: ReturnType<typeof workbookPreview>) => { raw.RowSchema[0].Identity = 'PaymentCurrency' }]) {
    const raw = workbookPreview(); mutate(raw); expect(() => normalize(raw)).toThrow('додаткові поля')
  }
})
it('rejects foreign or duplicated page rows and never attaches attribute evidence by a display caption', () => {
  const foreign = workbookPreview(); foreign.workbookPresentation.rows[0].rowSourceIndex = 13
  expect(() => normalize(foreign)).toThrow('додаткові поля')
  const duplicated = workbookPreview(); duplicated.workbookPresentation.rows.push(structuredClone(duplicated.workbookPresentation.rows[0]))
  expect(() => normalize(duplicated)).toThrow('додаткові поля')
})
it('requires the exact requested ordered subset and refuses unexpected/missing proof on a legacy request', () => {
  const result = normalize(), request = presentedCashRequest()
  expect(() => bindWorkbookPreview(request, result)).not.toThrow()
  expect(() => bindWorkbookPreview({ ...request, workbookPresentation: { version: 1, additionalFields: [33, 30], ordering: null } }, result)).toThrow()
  expect(() => bindWorkbookPreview({ ...request, workbookPresentation: undefined }, result)).toThrow()
  expect(() => bindWorkbookPreview(request, { ...result, WorkbookPresentation: undefined })).toThrow()
})
it('retains full currency witnesses when Currency is unselected and refuses empty witness coverage', () => {
  const raw = workbookPreview(); raw.workbookPresentation.selection.additionalFields = [33]
  raw.workbookPresentation.fields = raw.workbookPresentation.fields.filter(field => field.type === 33)
  raw.workbookPresentation.rows[0].values = raw.workbookPresentation.rows[0].values.filter(value => value.type === 33)
  expect(normalize(raw).WorkbookPresentation?.rows[0].currencyWitnesses).toHaveLength(1)
  raw.workbookPresentation.rows[0].currencyWitnesses = []
  expect(() => normalize(raw)).toThrow()
})
it('keeps more than64 genuinely attributed currencies complete rather than clipping or sampling them', () => {
  const raw = workbookPreview(), row = raw.workbookPresentation.rows[0]
  row.currencyWitnesses = Array.from({ length: 65 }, (_, index) => ({ ...row.currencyWitnesses[0], id: String(index + 1), name: `Валюта ${index}`, code: null }))
  row.values[0] = { type: 30, state: 'mixed', values: row.currencyWitnesses.map(item => item.name!), inputSha256: null }
  expect(normalize(raw).WorkbookPresentation?.rows[0].currencyWitnesses).toHaveLength(65)
  expect(normalize(raw).Cells[0].Value.Value).toBeNull()
})
it('keeps conflicting currency captions unavailable and rejects a claimed single known currency', () => {
  const raw = workbookPreview(), row = raw.workbookPresentation.rows[0]
  row.currencyWitnesses.push({ ...row.currencyWitnesses[0], name: 'Інша назва' })
  expect(() => normalize(raw)).toThrow()
  row.values[0] = { type: 30, state: 'unavailable', values: [], inputSha256: null }
  expect(workbookAttributeText(normalize(raw).WorkbookPresentation?.rows[0].values[0])).toBe('—')
})
it('distinguishes known explicit unassigned manager from missing evidence and never fabricates numeric attributes', () => {
  const raw = workbookPreview()
  raw.Request.DataSource = 'NativeSettlementPeriod'; raw.RowSchema = [
    { Identity: 'Organization', Caption: 'Організація' }, { Identity: 'SettlementCounterparty', Caption: 'Контрагент' }]
  raw.Rows[0].Values = [{ Caption: 'Організація' }, { Caption: 'Покупець' }]
  raw.workbookPresentation.selection.additionalFields = [60]
  raw.workbookPresentation.fields = [{ type: 60, caption: 'Менеджер', placement: 'column' }]
  raw.workbookPresentation.rows[0].values = [{ type: 60, state: 'null', values: [], inputSha256: 'c'.repeat(64) }]
  expect(workbookAttributeText(normalize(raw).WorkbookPresentation?.rows[0].values[0])).toBe('∅')
  raw.workbookPresentation.rows[0].values[0].state = 'unavailable'
  expect(workbookAttributeText(normalize(raw).WorkbookPresentation?.rows[0].values[0])).toBe('—')
  raw.workbookPresentation.rows[0].values[0].inputSha256 = null
  expect(() => normalize(raw)).toThrow()
})
it('preserves .NET whitespace and lossless currency descriptions instead of applying JavaScript trim semantics', () => {
  const raw = workbookPreview(), row = raw.workbookPresentation.rows[0]
  row.currencyWitnesses[0].name = '\ufeff'; row.currencyWitnesses[0].code = '\u0085'
  row.values[0].values = ['\ufeff']
  expect(normalize(raw).WorkbookPresentation?.rows[0].values[0].values).toEqual(['\ufeff'])
})
it('keeps Article/Top as metadata only and binds MonthAscending without inventing product values', () => {
  const raw = workbookPreview(); raw.Request.DataSource = 'NativeDayOrganizationGrossProfit'
  raw.RowSchema = [{ Identity: 'Day', Caption: 'День' }, { Identity: 'Organization', Caption: 'Організація' }]
  raw.Rows[0].Values = [{ Caption: '01.10.2026' }, { Caption: 'Організація' }]
  raw.workbookPresentation.selection = { version: 1, additionalFields: [2, 3], ordering: 'MonthAscending' }
  raw.workbookPresentation.fields = [{ type: 2, caption: 'Артикул', placement: 'retainedSetting' }, { type: 3, caption: 'Топ', placement: 'retainedSetting' }]
  raw.workbookPresentation.rows = []
  const result = normalize(raw)
  expect(result.WorkbookPresentation?.rows).toEqual([])
  expect(result.WorkbookPresentation?.selection.ordering).toBe('MonthAscending')
  expect(result.Rows[0].Values).toEqual(raw.Rows[0].Values)
})
it('rejects unknown output fields, bad UTF16, wrong field placement and finance-like unsupported states', () => {
  const unknown = workbookPreview(); Object.assign(unknown.workbookPresentation, { future: true }); expect(() => normalize(unknown)).toThrow()
  const placement = workbookPreview(); placement.workbookPresentation.fields[0].placement = 'column'; expect(() => normalize(placement)).toThrow()
  const text = workbookPreview(); text.workbookPresentation.rows[0].values[0].values = ['\ud800']; expect(() => normalize(text)).toThrow()
  const hash = workbookPreview(); hash.workbookPresentation.rows[0].values[0].inputSha256 = 'c'.repeat(64); expect(() => normalize(hash)).toThrow()
})
