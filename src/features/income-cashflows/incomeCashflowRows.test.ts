import { describe, expect, it } from 'vitest'
import { buildIncomeCashflowRow } from './incomeCashflowRows'

const amgShortName = 'ТОВ «АМГ «КОНКОРД»'
const amgFullName = 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "АВТОМОБІЛЬНА МОТОРИЗАЦІЙНА ГРУПА "КОНКОРД"'

describe('income cashflow rows', () => {
  it('shows the short organization name instead of the legal full name', () => {
    const row = buildIncomeCashflowRow({
      NetUid: 'income-1',
      Organization: { Name: amgShortName, FullName: amgFullName },
    })

    expect(row.organization).toBe(amgShortName)
  })

  it('leaves the organization empty when the order has none', () => {
    expect(buildIncomeCashflowRow({ NetUid: 'income-2' }).organization).toBeUndefined()
  })
})
