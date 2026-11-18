import { describe, expect, it } from 'vitest'
import { buildSupplierDisplayNames, getSupplierKey } from './supplierDisplayName'

describe('supplier display names', () => {
  it('shows the 1C card name and adds a code only when the names are identical', () => {
    const suppliers = [
      { FullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "ПЛА-ТАН І К"', Id: 635333, Name: 'ПЛА-ТАН І К ТОВ (MARS+AYFAR)', SourceFenixCode: 8095 },
      { FullName: 'ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "ПЛА-ТАН І К"', Id: 631634, Name: 'ПЛА-ТАН І К ТОВ', SourceFenixCode: 5434 },
      { Id: 631636, Name: 'ПЛА-ТАН І К ТОВ', SourceFenixCode: 5435 },
      { Id: 1, Name: 'Двійник', SourceFenixCode: 7 },
      { Id: 2, Name: 'Двійник', SourceFenixCode: 7 },
      { FullName: 'Лише повна назва', Id: 3 },
      { Id: 635333, Name: 'ПЛА-ТАН І К ТОВ (MARS+AYFAR)' },
      null,
    ]
    const names = buildSupplierDisplayNames(suppliers)
    const name = (id: number) => names.get(getSupplierKey({ Id: id }) as string)

    expect(name(635333)).toBe('ПЛА-ТАН І К ТОВ (MARS+AYFAR)')
    expect(name(631634)).toBe('ПЛА-ТАН І К ТОВ (5434)')
    expect(name(631636)).toBe('ПЛА-ТАН І К ТОВ (5435)')
    expect(name(1)).toBe('Двійник (1)')
    expect(name(2)).toBe('Двійник (2)')
    expect(name(3)).toBe('Лише повна назва')
  })
})
