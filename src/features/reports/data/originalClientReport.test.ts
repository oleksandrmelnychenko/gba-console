import { expect, it } from 'vitest'
import { clientAgreement, clientCapability, clientOrg, clientParty, clientResult, missingClient } from '../testing/originalPlannedCashClientFixtures'
import { clientFieldSelectable, clientPeriodError, clientRequest, emptyClientSelection, isClientCapability, normalizeClientResult } from './originalClientReport'
const request = () => clientRequest(clientCapability, '2026-10-01', '2026-10-04')
it('own default10 capability remains distinct from the statement and refuses native/full-task claims', () => {
  expect(isClientCapability(clientCapability)).toBe(true)
  for (const changed of [{ World: 'amg' }, { SourceId: '8fde42fc-6e49-4a8e-9096-74bbe14fe901' }, { DefaultMeasures: [] }, { RequiresAllParentSourceIdentities: false }, { SourceParityVerified: true }])
    expect(isClientCapability({ ...clientCapability, ...changed })).toBe(false)
})
it('selected requests contain exact three arrays only and native NULL is legal solely for Counterparties', () => {
  const selected = { Организация: [clientOrg], Контрагент: ['NULL'], ДоговорКонтрагента: [clientAgreement] }
  expect(clientRequest(clientCapability, '2026-10-01', '2026-10-04', selected)).toMatchObject({ Organizations: [clientOrg], Counterparties: ['NULL'], Agreements: [clientAgreement] })
  expect(Object.keys(request())).not.toContain('ChoicesWitnessSha256')
  expect(() => clientRequest(clientCapability, '2026-10-01', '2026-10-04', { ...selected, Организация: ['NULL'] })).toThrow()
  expect(clientRequest(clientCapability, '2026-10-01', '2026-10-04', { ...selected, Контрагент: ['0'.repeat(32)] }).Counterparties).toEqual(['0'.repeat(32)])
})
it('the twelve-month limit uses calendar leap-day clamping and invalid reversed dates refuse', () => {
  expect(clientPeriodError('2024-02-29', '2025-02-27')).toBeNull()
  expect(clientPeriodError('2024-02-29', '2025-02-28')).not.toBeNull()
  expect(clientPeriodError('2026-10-04', '2026-10-01')).not.toBeNull()
})
it('full hierarchy all10 signed fixed strings and quantity scale3 survive without client recalculation', () => {
  expect(normalizeClientResult(clientResult(), request())).toEqual(clientResult())
  const result = clientResult(); result.Rows[0].Children[0].Children[0].Values.КоличествоПриход = '2.50'
  expect(() => normalizeClientResult(result, request())).toThrow()
})
it('missing original source-generation remains unavailable and cannot borrow old totals choices or witnesses', () => {
  expect(normalizeClientResult(missingClient(), request()).Available).toBe(false)
  expect(() => normalizeClientResult({ ...missingClient(), Choices: clientResult().Choices }, request())).toThrow()
  expect(() => normalizeClientResult({ ...clientResult(), NormalInputsComplete: false }, request())).toThrow()
})
it('missing human captions keep separate rows but disable their whole filter field while other fields stay supported', () => {
  const result = clientResult(); result.Rows[0].Children[0].Caption = 'Назва недоступна'; result.Rows[0].Children[0].CaptionAvailable = false
  result.Choices.Контрагент = [{ Key: clientParty, Caption: 'Назва недоступна', CaptionAvailable: false }]
  const accepted = normalizeClientResult(result, request())
  expect(clientFieldSelectable(accepted, 'Контрагент')).toBe(false)
  expect(clientFieldSelectable(accepted, 'Организация')).toBe(true)
  expect(clientFieldSelectable(accepted, 'ДоговорКонтрагента')).toBe(true)
  const zero = clientResult(); zero.Rows[0].Key = '0'.repeat(32); zero.Rows[0].Caption = 'Назва недоступна'; zero.Rows[0].CaptionAvailable = false
  zero.Choices.Организация = [{ Key: '0'.repeat(32), Caption: 'Назва недоступна', CaptionAvailable: false }]
  expect(normalizeClientResult(zero, request()).Rows[0].Key).toBe('0'.repeat(32))
  expect(clientFieldSelectable(zero, 'Организация')).toBe(false)
})
it('wrong row depth missing full-universe membership mismatched caption and request echo refuse', () => {
  const result = clientResult()
  expect(() => normalizeClientResult({ ...result, Selectors: { ...emptyClientSelection(), Контрагент: [clientParty] } }, request())).toThrow()
  expect(() => normalizeClientResult({ ...result, Choices: { ...result.Choices, Организация: [] } }, request())).toThrow()
  expect(() => normalizeClientResult({ ...result, Rows: [{ ...result.Rows[0], Field: 'Контрагент' }] }, request())).toThrow()
  expect(() => normalizeClientResult({ ...result, Rows: [{ ...result.Rows[0], Caption: 'Інша назва' }] }, request())).toThrow()
})
it('known empty keeps genuine zero totals and full unfiltered choices while null totals are not manufactured', () => {
  const result = clientResult(); result.Rows = []; result.Code = 'original_client_report_declared_calendar_empty'
  result.Totals = Object.fromEntries(Object.keys(result.Totals!).map(key => [key, key.startsWith('Количество') ? '0.000' : '0.00'])) as typeof result.Totals
  expect(normalizeClientResult(result, request()).Choices).toEqual(clientResult().Choices)
  expect(() => normalizeClientResult({ ...result, Totals: clientResult().Totals }, request())).toThrow()
  expect(() => normalizeClientResult({ ...result, Totals: null }, request())).toThrow()
})
