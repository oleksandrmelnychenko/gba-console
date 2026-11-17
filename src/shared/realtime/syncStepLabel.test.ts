import { describe, expect, it } from 'vitest'
import { formatSyncStepLabel, humanizeSyncStepKeys } from './syncStepLabel'

describe('sync step labels', () => {
  it('turns a dotted failed-step key into Ukrainian labels', () => {
    expect(formatSyncStepLabel('DailySession.MasterData.ExchangeRates'))
      .toBe('Щоденна синхронізація → Довідники та основні дані → Курси валют')
    expect(formatSyncStepLabel('ExchangeRates')).toBe('Курси валют')
  })

  it('keeps unknown segments and non-key text as they are', () => {
    expect(formatSyncStepLabel('FullSession.Documents.SomethingNew')).toBe('Повна синхронізація → Документи → SomethingNew')
    expect(formatSyncStepLabel('Помилка')).toBe('Помилка')
    expect(formatSyncStepLabel(null)).toBe('')
  })

  it('replaces keys embedded in a server message', () => {
    expect(humanizeSyncStepKeys('Помилка синхронізації (DailySession.MasterData.ExchangeRates)'))
      .toBe('Помилка синхронізації (Щоденна синхронізація → Довідники та основні дані → Курси валют)')
    expect(humanizeSyncStepKeys('19.10.2026 12:00:02 - Синхронізацію завершено')).toBe('19.10.2026 12:00:02 - Синхронізацію завершено')
  })
})
