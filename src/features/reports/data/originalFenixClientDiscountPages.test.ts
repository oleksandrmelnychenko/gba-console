import { expect, it } from 'vitest'
import { fenixChoicePageRequest, fenixCaptionsForSelection, normalizeFenixChoiceCatalogue, normalizeFenixChoicePage, selectedFenixPagedRequest, emptyFenixCaptions } from './originalFenixClientDiscountPages'
import { emptyFenixSelection } from './originalFenixClientDiscounts'
import { fenixCatalogue, fenixChoicePage, fenixProductChoices } from '../testing/originalFenixClientDiscountPagesFixtures'
import { fenixScope, fenixChoices, fenixProduct } from '../testing/originalFenixClientDiscountsFixtures'
it('keeps measured full counts without requesting or fabricating379001 option rows', () => {
  const catalogue = fenixCatalogue(); catalogue.Counts.Номенклатура = 371292; catalogue.Counts.ПолучательСкидки = 7709
  const result = normalizeFenixChoiceCatalogue(catalogue, fenixScope())
  expect(result.Counts.Номенклатура + result.Counts.ПолучательСкидки).toBe(379001); expect('Choices' in result).toBe(false)
})
it('detaches exact date/header/universe/search/selected page query and caps display at100', () => {
  const catalogue = fenixCatalogue(), selected = [fenixProduct], query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', 'Товар', 0, selected)
  selected[0] = '0'.repeat(32); expect(query.SelectedKeys).toEqual([fenixProduct]); expect(query.Limit).toBe(100)
  expect(query.InputWitnessSha256).toBe(catalogue.InputWitnessSha256); expect(query.ChoicesWitnessSha256).toBe(catalogue.ChoicesWitnessSha256)
})
it('normalizes successive pages with exact total and authentic selected captions outside the visible page', () => {
  const catalogue = fenixCatalogue(), universe = fenixProductChoices(201); catalogue.Counts.Номенклатура = 201
  const query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', 'Product', 100, [universe[0].Key])
  const page = normalizeFenixChoicePage(fenixChoicePage(query, catalogue, universe), query, catalogue)
  expect(page.Items).toHaveLength(100); expect(page.Total).toBe(201); expect(page.NextOffset).toBe(200); expect(page.SelectedChoices[0].Key).toBe(universe[0].Key)
  expect(fenixCaptionsForSelection(page, [universe[0].Key, universe[101].Key])).toHaveLength(2)
})
it('refuses altered date/header/universe/counted page and pagination echoes', () => {
  const catalogue = fenixCatalogue(), query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', '', 0), valid = fenixChoicePage(query, catalogue)
  const faults = [{ ...valid, Search: 'other' }, { ...valid, Offset: 1 }, { ...valid, NextOffset: 1 }, { ...valid, Total: 2 }, { ...valid, Items: [] },
    { ...valid, Catalogue: { ...catalogue, Through: '2026-10-01' } }, { ...valid, Catalogue: { ...catalogue, InputWitnessSha256: 'd'.repeat(64) } }, { ...valid, Catalogue: { ...catalogue, ChoicesWitnessSha256: 'a'.repeat(64) } }]
  for (const fault of faults) expect(() => normalizeFenixChoicePage(fault, query, catalogue)).toThrow()
})
it('refuses foreign selected keys, duplicates and conflicting off-page captions', () => {
  const catalogue = fenixCatalogue(), query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', '', 0, [fenixProduct]), valid = fenixChoicePage(query, catalogue)
  expect(() => normalizeFenixChoicePage({ ...valid, SelectedChoices: [{ ...valid.Items[0], Caption: 'changed' }] }, query, catalogue)).toThrow()
  expect(() => fenixCaptionsForSelection(valid, ['0'.repeat(32)])).toThrow(); expect(() => fenixCaptionsForSelection(valid, [fenixProduct, fenixProduct])).toThrow()
})
it('keeps complete empty search distinct from missing publication or unavailable caption family', () => {
  const catalogue = fenixCatalogue(), query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', 'no match', 0)
  const page = normalizeFenixChoicePage(fenixChoicePage(query, catalogue), query, catalogue); expect(page.Items).toEqual([]); expect(page.Total).toBe(0); expect(page.Catalogue.FieldAvailability.Номенклатура).toBe(true)
  expect(() => fenixChoicePageRequest(fenixScope().Through, { ...catalogue, FieldAvailability: { ...catalogue.FieldAvailability, Номенклатура: false } }, 'Номенклатура', '', 0)).toThrow()
})
it('selected request keeps whole-universe witness and typed membership while a partial displayed page never becomes the universe', () => {
  const catalogue = fenixCatalogue(), query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', '', 0), page = fenixChoicePage(query, catalogue)
  const selected = { ...emptyFenixSelection(), Номенклатура: [fenixProduct] }, captions = { ...emptyFenixCaptions(), Номенклатура: fenixCaptionsForSelection(page, selected.Номенклатура) }
  expect(selectedFenixPagedRequest(fenixScope().Through, selected, catalogue, captions).ChoicesWitnessSha256).toBe(catalogue.ChoicesWitnessSha256)
  expect(() => selectedFenixPagedRequest('2026-10-01', selected, catalogue, captions)).toThrow()
  expect(() => selectedFenixPagedRequest(fenixScope().Through, { ...selected, Номенклатура: ['0'.repeat(32)] }, catalogue, captions)).toThrow()
})
it('rejects long/unpaired searches, invalid offsets and stale catalogue before page I/O', () => {
  const catalogue = fenixCatalogue()
  for (const search of ['x'.repeat(101), '\ud800']) expect(() => fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', search, 0)).toThrow()
  for (const offset of [-1, 1.5, 500001]) expect(() => fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', '', offset)).toThrow()
})
it('preserves actual padded numeric and reference-like captions without exposing invented labels', () => {
  const catalogue = fenixCatalogue(), query = fenixChoicePageRequest(fenixScope().Through, catalogue, 'Номенклатура', '', 0)
  for (const caption of ['  actual  ', '123', fenixProduct]) {
    const page = fenixChoicePage(query, catalogue); page.Items[0].Caption = caption
    expect(normalizeFenixChoicePage(page, query, catalogue).Items[0].Caption).toBe(caption)
  }
})
it('catalogue misses do not manufacture empty authoritative families', () => {
  const catalogue = fenixCatalogue(fenixChoices()); catalogue.FieldAvailability.Номенклатура = false
  expect(() => normalizeFenixChoiceCatalogue(catalogue, fenixScope())).toThrow()
  catalogue.Counts.Номенклатура = 0; catalogue.MissingFamilies = ['Номенклатура']; catalogue.HumanChoicesAvailable = false
  expect(normalizeFenixChoiceCatalogue(catalogue, fenixScope()).FieldAvailability.Номенклатура).toBe(false)
})
