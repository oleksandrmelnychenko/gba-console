import { amgDiscountRequest, amgRecipientKey, type AmgDiscountChoices, type AmgDiscountReadiness, type AmgDiscountRequest, type AmgDiscountResult } from '../data/originalAmgClientDiscounts'
export const amgProduct = '1'.repeat(32), amgClient = { Type: '08', Table: '0000005A', Reference: '2'.repeat(32) }
export const amgWitness = 'b'.repeat(64), amgRegion = 'Київ'
export const amgScope = () => amgDiscountRequest('2026-09-30')
export const amgReadiness: AmgDiscountReadiness = {
  Version: 1, World: 'amg', SourceId: amgScope().SourceId, DefinitionSha256: amgScope().DefinitionSha256,
  ModuleSha256: '7bd692b383d5a2dc52645e4d1316bb292abb5904944bb686b3075db6e5795967', QuerySha256: '6176122623be4ad0696ff2b614943d645c9290b094f9babe7f0f48854e13e2b8',
  DefaultRows: ['ПолучательСкидки'], DefaultColumns: ['Номенклатура'], DefaultMeasures: ['ПроцентСкидкиНаценки'], Filters: ['Номенклатура', 'ПолучательСкидки', 'КодПоРегиону'],
  Aggregation: 'MaximumAtRecipientProductGrain', DecimalPlaces: 2, SupportedRecipientTable: '0000005A', SupportedPercentageType: '03',
  Executable: true, OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, Dependency: null, InputWitnessSha256: 'a'.repeat(64),
  NativeRecipientUniverseVerified: false, OriginalFullTaskAccepted: false, SourceSyncEnabled: false, HumanChoicesAvailable: false, CurrentSourceVerified: false, SourceParityVerified: false, NativeDateParametersVerified: false,
}
export function amgResult(request: AmgDiscountRequest = amgScope()): AmgDiscountResult {
  return { ...structuredClone(request), InputAvailable: true, OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, Dependency: null,
    Cells: [{ Recipient: { ...amgClient }, RecipientName: 'Клієнт AMG', Product: amgProduct, ProductName: 'Товар AMG', RegionCode: amgRegion, Percentage: '-12.34', FactRows: 2 }],
    MaximumPercentage: '-12.34', InputWitnessSha256: 'c'.repeat(64), ResultSha256: 'd'.repeat(64), PeriodPolicy: 'DeclaredLastWholeSecond',
    SourceParityVerified: false, NativeDateParametersVerified: false, NativeStringComparisonVerified: false, AppliesFxConversion: false }
}
export function amgEmpty(request: AmgDiscountRequest = amgScope()): AmgDiscountResult { return { ...amgResult(request), Cells: [], MaximumPercentage: null } }
export function amgMissing(request: AmgDiscountRequest = amgScope()): AmgDiscountResult {
  return { ...amgEmpty(request), InputAvailable: false, OrdinaryPublicationAvailable: false, OurSnapshotVerified: false, Dependency: 'ordinary_amg_discount_publication_unavailable', InputWitnessSha256: null }
}
export function amgChoices(request: AmgDiscountRequest = amgScope()): AmgDiscountChoices {
  return { Version: 1, World: 'amg', SourceId: request.SourceId, DefinitionSha256: request.DefinitionSha256, Through: request.Through,
    RequestedProducts: [...request.Products], RequestedRecipients: structuredClone(request.Recipients), RequestedRegionCodes: [...request.RegionCodes],
    OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, Dependency: null, FieldAvailability: { Номенклатура: true, ПолучательСкидки: true, КодПоРегиону: true },
    Choices: { Номенклатура: [{ Field: 'Номенклатура', Type: '08', TableReference: '0000006C', Key: amgProduct, Caption: 'Товар AMG', Deleted: false }],
      ПолучательСкидки: [{ Field: 'ПолучательСкидки', Type: '08', TableReference: '0000005A', Key: amgRecipientKey(amgClient), Caption: 'Клієнт AMG', Deleted: false }],
      КодПоРегиону: [{ Field: 'КодПоРегиону', Type: 'string', TableReference: null, Key: amgRegion, Caption: amgRegion, Deleted: false }] },
    MissingFamilies: [], InputWitnessSha256: 'a'.repeat(64), ChoicesWitnessSha256: amgWitness, ResultSha256: 'e'.repeat(64), HumanChoicesAvailable: true,
    NativeRecipientUniverseVerified: false, CurrentSourceVerified: false, SourceParityVerified: false }
}
