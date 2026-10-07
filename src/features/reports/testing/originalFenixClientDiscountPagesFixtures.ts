import type { FenixDiscountChoice, FenixDiscountChoices } from '../data/originalFenixClientDiscounts'
import type { FenixDiscountCatalogue, FenixDiscountChoicePage, FenixDiscountChoicePageRequest } from '../data/originalFenixClientDiscountPages'
import { fenixChoices } from './originalFenixClientDiscountsFixtures'
export function fenixCatalogue(names: FenixDiscountChoices = fenixChoices()): FenixDiscountCatalogue {
  const { Choices, ...base } = structuredClone(names)
  return { ...base, Counts: { Номенклатура: Choices.Номенклатура.length, ПолучательСкидки: Choices.ПолучательСкидки.length, КодПоРегиону: Choices.КодПоРегиону.length } }
}
export function fenixChoicePage(query: FenixDiscountChoicePageRequest, catalogue: FenixDiscountCatalogue, universe: FenixDiscountChoice[] = fenixChoices(query.Scope).Choices[query.Field]): FenixDiscountChoicePage {
  const filtered = universe.filter(c => c.Caption.toUpperCase().includes(query.Search.toUpperCase())), items = filtered.slice(query.Offset, query.Offset + query.Limit)
  return { Catalogue: structuredClone(catalogue), Field: query.Field, Search: query.Search, Offset: query.Offset, Limit: query.Limit, Total: filtered.length,
    NextOffset: query.Offset + items.length < filtered.length ? query.Offset + items.length : null,
    Items: structuredClone(items), SelectedKeys: [...query.SelectedKeys], SelectedChoices: query.SelectedKeys.map(key => { const row = universe.find(c => c.Key === key); if (!row) throw new Error('fixture membership'); return structuredClone(row) }), ResultSha256: 'f'.repeat(64) }
}
export function fenixProductChoices(count: number): FenixDiscountChoice[] {
  return Array.from({ length: count }, (_, i) => ({ Field: 'Номенклатура', Type: '08', TableReference: '00000054', Key: (i + 1).toString(16).toUpperCase().padStart(32, '0'), Caption: `Product ${(i + 1).toString().padStart(4, '0')}`, Deleted: false }))
}
