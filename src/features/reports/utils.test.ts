import { describe, expect, it } from 'vitest'
import { buildReportFileName } from './utils'

describe('buildReportFileName', () => {
  it('names the export after the run instead of the engine guid', () => {
    expect(
      buildReportFileName(
        ['reports-stocks', 'Щоденні залишки', '2026-01-01', '2026-07-27', 'Товар Клієнт', '20260727-1015'],
        'csv',
      ),
    ).toBe('reports-stocks_Щоденні-залишки_2026-01-01_2026-07-27_Товар-Клієнт_20260727-1015.csv')
  })

  it('skips the parts a run does not have', () => {
    expect(buildReportFileName(['reports-stocks', '', undefined, null, '2026-07-27'], 'csv'))
      .toBe('reports-stocks_2026-07-27.csv')
  })

  it('falls back to a usable name when nothing identifies the run', () => {
    expect(buildReportFileName([undefined, '  '], 'csv')).toBe('report.csv')
  })
})
