import { expect, it } from 'vitest'
import { createManagementOrdersRequest, managementOrdersWindows, isManagementOrdersCapabilities, isManagementOrdersCatalogueEntry,
  managementOrdersMonthError, normalizeManagementOrdersReport } from './managementOrders'
import { managementOrdersCapability, managementOrdersCatalogueEntry, managementOrdersEmptyReport, managementOrdersMissingReport,
  managementOrdersReport, managementOrdersUnknownCurrentReport, managementOrdersZeroReport, managementOrdersNullPreviousReport, managementOrdersUnknownCurrentZeroPreviousReport } from './managementOrders.test-fixtures'

it('binds exact original identity, field order, raw values and explicit management currency without native parity', () => {
  const capability = managementOrdersCapability(), report = managementOrdersReport(), request = createManagementOrdersRequest(capability, report.Month)
  expect(isManagementOrdersCapabilities(capability)).toBe(true); expect(isManagementOrdersCatalogueEntry(managementOrdersCatalogueEntry())).toBe(true)
  expect(normalizeManagementOrdersReport(report, request)).toBe(report)
  expect(report.Columns.map(column => column.Caption)).toEqual(['Текущее значение', 'Значение предыдущего периода', 'Изменение %', 'Изменение (абс)'])
  expect(report.Totals.map(cell => cell.Value)).toEqual(['-5', '-10', '-50', '5'])
  expect(report.ManagementCurrency).toBe('Управлінська валюта'); expect(report.SourceParityVerified).toBe(false)
})
it('produces only exact monthly/prior windows across January, leap years and physical bounds', () => {
  expect(managementOrdersWindows('2026-01').PreviousPeriod).toEqual({From:'2025-12-01T00:00:00.000',ThroughExclusive:'2026-01-01T00:00:00.000'})
  expect(managementOrdersWindows('2024-02').CurrentPeriod).toEqual({From:'2024-02-01T00:00:00.000',ThroughExclusive:'2024-03-01T00:00:00.000'})
  expect(managementOrdersWindows('0001-02').PreviousPeriod.From).toBe('0001-01-01T00:00:00.000')
  expect(managementOrdersWindows('7999-11').CurrentPeriod.ThroughExclusive).toBe('7999-12-01T00:00:00.000')
  expect(createManagementOrdersRequest(managementOrdersCapability(),'2026-09')).toEqual({Version:1,SourceIdentity:managementOrdersCapability().SourceIdentity,Month:'2026-09'})
})
it.each(['2026-9','2026-00','2026-13','2026-09-01','2026-09Z',' 2026-09','','0000-02','0001-01','7999-12','8000-01'])('refuses noncanonical or unsupported month %s without substituting today', month => {
  expect(managementOrdersMonthError(month)).not.toBeNull()
  expect(()=>createManagementOrdersRequest(managementOrdersCapability(),month)).toThrow()
})
it('keeps published empty, missing publication and known previous numbers distinct with no invented changes', () => {
  for (const report of [managementOrdersEmptyReport(), managementOrdersMissingReport(), managementOrdersUnknownCurrentReport()])
    expect(normalizeManagementOrdersReport(report, createManagementOrdersRequest(managementOrdersCapability(), report.Month))).toBe(report)
  expect(managementOrdersEmptyReport().Totals.every(cell => cell.Value === null)).toBe(true)
  expect(managementOrdersMissingReport().Inputs.Current.IncludedRows).toBeNull()
  expect(managementOrdersUnknownCurrentReport().Totals[1].Value).toBe('-10')
})
it('keeps caption unavailable or Source NULL independent from complete financial inputs', () => {
  const report = managementOrdersReport(), request = createManagementOrdersRequest(managementOrdersCapability(), report.Month)
  report.Rows[0] = { ...report.Rows[0], Caption: null, NameAvailable: false }; report.CounterpartyNamesComplete = false
  expect(normalizeManagementOrdersReport(report, request)).toBe(report)
  report.Rows[0] = { ...report.Rows[0], SourceNull: true, NameAvailable: true }; report.CounterpartyNamesComplete = true
  expect(normalizeManagementOrdersReport(report, request)).toBe(report)
})
it('accepts complete decimal overflow with exact evidence and preserves server formatting rather than calculating it', () => {
  const report = managementOrdersReport(), request = createManagementOrdersRequest(managementOrdersCapability(), report.Month)
  report.Code = 'decimal_projection_unavailable'; report.Totals[0] = { ...report.Totals[0], Available: false, Value: null, FormattedValue: null,
    ExactValue: { Numerator: '-100000000000000000000000000000', Denominator: '1' } }
  expect(normalizeManagementOrdersReport(report, request)).toBe(report)
  report.Totals[1] = { ...report.Totals[1], Value: '-10.000000000000000000000000001', FormattedValue: '-10.000000000000000000000000001',
    ExactValue: { Numerator: '-10000000000000000000000000001', Denominator: '1000000000000000000000000000' } }
  expect(normalizeManagementOrdersReport(report, request).Totals[1].FormattedValue).toBe('-10.000000000000000000000000001')
})
it.each(['identity', 'month', 'period', 'column', 'currency', 'parity', 'record_kind_policy', 'zero_suppression', 'row_cap', 'pages_cap', 'included_rows', 'page_count', 'duplicate_group', 'row_key', 'caption', 'complete', 'unknown_count', 'empty_change', 'parent_vector', 'parent_hash', 'duplicate_run', 'clock', 'unsafe_file'])('refuses an inconsistent %s response without exposing files', kind => {
  const report = managementOrdersReport(), request = createManagementOrdersRequest(managementOrdersCapability(), report.Month)
  if (kind === 'identity') Reflect.set(report.SourceIdentity,'World','amg')
  else if (kind === 'month') report.Month='2026-10'
  else if (kind === 'record_kind_policy') Reflect.set(report,'RecordKindMappingBasis','guessed')
  else if (kind === 'zero_suppression') Reflect.set(report,'NativeVirtualTableZeroSuppressionVerified',true)
  else if (kind === 'row_cap') report.Proof.Publications[0].PhysicalRows=200001
  else if (kind === 'pages_cap') report.Proof.Publications[0].PagesPerPass=783
  else if (kind === 'included_rows') report.Inputs.Current.IncludedRows=2
  else if (kind === 'page_count') report.Proof.Publications[0].PagesPerPass=2
  else if (kind === 'duplicate_group') report.Rows.push(structuredClone(report.Rows[0]))
  else if (kind === 'period') report.PreviousPeriod.From = '2026-07-01T00:00:00.000'
  else if (kind === 'column') report.Columns.reverse()
  else if (kind === 'currency') Reflect.set(report,'ManagementCurrency','EUR')
  else if (kind === 'parity') Reflect.set(report,'SourceParityVerified',true)
  else if (kind === 'row_key') report.Rows[0].Key = '00000000000000000000000000000001'
  else if (kind === 'caption') report.Rows[0].NameAvailable = false
  else if (kind === 'complete') report.Complete = false
  else if (kind === 'unknown_count') { report.Inputs.Current.Available = false; report.Inputs.Current.IncludedRows = 0 }
  else if (kind === 'empty_change') { Object.assign(report, managementOrdersEmptyReport()); report.Totals[2] = managementOrdersReport().Totals[2] }
  else if (kind === 'parent_vector') report.Proof.Publications.reverse()
  else if (kind === 'parent_hash') report.Proof.Publications[0].CompletePassSha256 = 'wrong'
  else if (kind === 'duplicate_run') report.Proof.Publications[1].RunId = report.Proof.Publications[0].RunId
  else if (kind === 'clock') report.ObservationStartedAtUtc = '2026-02-30T00:00:00.0000000Z'
  else report.DocumentURL = 'javascript:alert(1)'
  expect(() => normalizeManagementOrdersReport(report, request)).toThrow('непідтверджений результат')
})
it('requires genuine exact capabilities and never changes an unavailable runtime flag', () => {
  const capability = managementOrdersCapability(); capability.RuntimeImplemented = false
  expect(() => createManagementOrdersRequest(capability, '2026-09')).toThrow('Сервер не підтвердив')
  expect(capability.RuntimeImplemented).toBe(false)
  expect(isManagementOrdersCatalogueEntry({ ...managementOrdersCatalogueEntry(), Sources: [...managementOrdersCatalogueEntry().Sources, ...managementOrdersCatalogueEntry().Sources] })).toBe(false)
})

it('preserves server zero, logical NULL previous and the independent prior-zero hundred guard',()=>{
  for(const report of [managementOrdersZeroReport(),managementOrdersNullPreviousReport(),managementOrdersUnknownCurrentZeroPreviousReport()])
    expect(normalizeManagementOrdersReport(report,createManagementOrdersRequest(managementOrdersCapability(),report.Month))).toBe(report)
  expect(managementOrdersZeroReport().Totals.map(cell=>cell.Value)).toEqual(['0','0','100','0'])
  expect(managementOrdersNullPreviousReport().Totals[1]).toMatchObject({Available:true,Value:null})
  expect(managementOrdersUnknownCurrentZeroPreviousReport().Totals.map(cell=>cell.FormattedValue)).toEqual([null,'0','100.00',null])
})
it('does not turn unknown resources into numbers merely because physical monthly parents are complete',()=>{
  const report=managementOrdersUnknownCurrentReport(), ready=managementOrdersReport()
  report.Inputs.Current=ready.Inputs.Current;report.Proof=ready.Proof
  expect(normalizeManagementOrdersReport(report,createManagementOrdersRequest(managementOrdersCapability(),report.Month))).toBe(report)
  expect(report.Complete).toBe(false);expect(report.Totals[0].Available).toBe(false)
})
it('refuses a different request identity and capability aliases before accepting an unchanged result',()=>{
  const report=managementOrdersReport(),request=createManagementOrdersRequest(managementOrdersCapability(),report.Month)
  Reflect.set(request.SourceIdentity,'SourceId','dataset22');expect(()=>normalizeManagementOrdersReport(report,request)).toThrow()
  const capability=managementOrdersCapability();Reflect.set(capability,'InputBasis','OrderItemPrices')
  expect(isManagementOrdersCapabilities(capability)).toBe(false)
})
