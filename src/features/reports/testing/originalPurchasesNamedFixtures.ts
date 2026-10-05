import { purchasesFilters, purchasesRequest, purchasesSelectors, type PurchasesRequest, type PurchasesResult } from '../data/originalPurchases'
import { emptyPurchasesSelections, type PurchasesChoice, type PurchasesChoices } from '../data/originalPurchasesChoices'
import { purchasesCapability, purchasesParty, purchasesProduct, purchasesResponse, purchasesSecondProduct } from './originalPurchasesFixtures'

export const purchasesDivision = 'E'.repeat(32), purchasesProjectRef = 'F'.repeat(32)
export const purchasesDistributionProject = `08:0000001F:${purchasesProjectRef}`, purchasesMainProject = `08:00000069:${purchasesProjectRef}`
export const purchasesNamedScope = () => purchasesRequest(purchasesCapability, '2026-09-10', '2026-09-12')
export function purchasesNamedChoices(request: PurchasesRequest = purchasesNamedScope()): PurchasesChoices {
  return { Version: request.Version, World: request.World, SourceId: request.SourceId, DefinitionSha256: request.DefinitionSha256,
    From: request.From, Through: request.Through, Selectors: structuredClone(purchasesSelectors(request)), Measures: [...request.Measures],
    FieldAvailability: { СтатусПартии: false, Контрагент: true, Номенклатура: true, Подразделение: true, Проект: true },
    Choices: { СтатусПартии: [], Контрагент: [{ Field: 'Контрагент', Type: '08', TableReference: '00000044', Key: purchasesParty, Caption: 'Постачальник', Deleted: false }],
      Номенклатура: [purchasesProduct, purchasesSecondProduct].map<PurchasesChoice>((Key, index) => ({ Field: 'Номенклатура', Type: '08', TableReference: '00000054', Key, Caption: index ? 'Другий товар' : 'Перший товар', Deleted: false })),
      Подразделение: [{ Field: 'Подразделение', Type: '08', TableReference: '00000061', Key: purchasesDivision, Caption: 'Відділ закупівель', Deleted: false }],
      Проект: [{ Field: 'Проект', Type: '08', TableReference: '0000001F', Key: purchasesDistributionProject, Caption: 'Розподіл закупівель', Deleted: false },
        { Field: 'Проект', Type: '08', TableReference: '00000069', Key: purchasesMainProject, Caption: 'Основний проєкт', Deleted: true }] },
    FieldWitnessSha256: { Контрагент: 'c'.repeat(64), Номенклатура: 'd'.repeat(64), Подразделение: 'e'.repeat(64), Проект: 'f'.repeat(64) },
    MissingFamilies: ['СтатусПартии'], OurSnapshotVerified: true, ResultSha256: '1'.repeat(64), HumanChoicesAvailable: false,
    SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
export function purchasesMissingNames(): PurchasesChoices {
  return { ...purchasesNamedChoices(), FieldAvailability: { СтатусПартии: false, Контрагент: false, Номенклатура: false, Подразделение: false, Проект: false },
    Choices: { СтатусПартии: [], Контрагент: [], Номенклатура: [], Подразделение: [], Проект: [] }, FieldWitnessSha256: {}, MissingFamilies: [...purchasesFilters] }
}
export function namedPurchasesResponse(request: PurchasesRequest = purchasesNamedScope()): PurchasesResult {
  const result = purchasesResponse(request.Measures), names = purchasesNamedChoices(request)
  result.From = request.From; result.Through = request.Through; result.Selectors = structuredClone(purchasesSelectors(request))
  result.NamedChoiceWitnesses = { ...names.FieldWitnessSha256 }; result.NamedFieldAvailability = { ...names.FieldAvailability }
  for (const status of result.Rows) for (const party of status.Children) {
    party.Caption = 'Постачальник'; party.CaptionAvailable = true
    for (const product of party.Children) { product.Caption = product.Key === purchasesProduct ? 'Перший товар' : 'Другий товар'; product.CaptionAvailable = true }
    if (request.Products.length) party.Children = party.Children.filter(product => request.Products.includes(product.Key))
    if (party.Children.length === 1) {
      const values = { ...party.Children[0].Values }; party.Values = { ...values }; status.Values = { ...values }; result.Totals = { ...values }
    }
  }
  return result
}
export function purchasesAllSelected() {
  return { ...emptyPurchasesSelections(), Контрагент: [purchasesParty], Номенклатура: [purchasesProduct], Подразделение: [purchasesDivision],
    Проект: [purchasesDistributionProject, purchasesMainProject] }
}
