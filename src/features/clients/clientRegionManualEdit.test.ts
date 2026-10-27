import { describe, expect, it } from 'vitest'
import { translate } from '../../shared/i18n/translate'
import { formatClientRegionManualEditTime, getClientRegionManualEditNote } from './clientRegionManualEdit'

const t = (key: string, params?: Record<string, string | number | null | undefined>) => translate(key, params, 'uk')

describe('client region manual edit note', () => {
  it('shows who changed the region code in the client card and when, in Kyiv time', () => {
    expect(getClientRegionManualEditNote({
      ClientId: 10,
      EditedByName: ' Петренко Олена Іванівна ',
      EditedAtUtc: '2026-10-27T09:30:00.1234567',
      Source: 1,
    }, t)).toBe('Код по регіону змінено вручну: Петренко Олена Іванівна, 27.10.2026, 11:30. Синхронізація з 1С його не змінює.')
  })

  it('names the region code directory and copes with a missing user name', () => {
    expect(getClientRegionManualEditNote({
      ClientId: 10,
      EditedByName: null,
      EditedAtUtc: '2026-07-01T21:15:00Z',
      Source: 2,
    }, t)).toBe('Код по регіону змінено в довіднику регіонів 02.07.2026, 00:15. Синхронізація з 1С його не змінює.')
    expect(getClientRegionManualEditNote({
      ClientId: 10,
      EditedByName: 'Іваненко Іван',
      EditedAtUtc: '2026-07-01T21:15:00+00:00',
      Source: 'RegionCodeDirectory',
    }, t)).toBe('Код по регіону змінено в довіднику регіонів: Іваненко Іван, 02.07.2026, 00:15. Синхронізація з 1С його не змінює.')
    expect(getClientRegionManualEditNote({
      ClientId: 10,
      EditedAtUtc: '2026-10-27T09:30:00',
      Source: 1,
    }, t)).toBe('Код по регіону змінено вручну 27.10.2026, 11:30. Синхронізація з 1С його не змінює.')
  })

  it('keeps an unreadable time as received', () => {
    expect(formatClientRegionManualEditTime('not a date')).toBe('not a date')
  })
})
