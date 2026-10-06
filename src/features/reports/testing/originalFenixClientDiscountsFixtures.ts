import { fenixDiscountRequest, fenixRecipientKey, type FenixDiscountChoices, type FenixDiscountReadiness, type FenixDiscountRequest, type FenixDiscountResult } from '../data/originalFenixClientDiscounts'
export const fenixProduct = '1'.repeat(32), fenixClient = { Type: '08', Table: '00000044', Reference: '2'.repeat(32) }
export const fenixWitness = 'b'.repeat(64), fenixRegion = 'Київ'
export const fenixScope = () => fenixDiscountRequest('2026-09-30')
export const fenixReadiness: FenixDiscountReadiness = {
  Version: 1, World: 'fenix', SourceId: fenixScope().SourceId, DefinitionSha256: fenixScope().DefinitionSha256,
  ModuleSha256: '7bd692b383d5a2dc52645e4d1316bb292abb5904944bb686b3075db6e5795967', QuerySha256: '6176122623be4ad0696ff2b614943d645c9290b094f9babe7f0f48854e13e2b8',
  DefaultRows: ['ПолучательСкидки'], DefaultColumns: ['Номенклатура'], DefaultMeasures: ['ПроцентСкидкиНаценки'], Filters: ['Номенклатура', 'ПолучательСкидки', 'КодПоРегиону'],
  Aggregation: 'MaximumAtRecipientProductGrain', DecimalPlaces: 2, SupportedRecipientTable: '00000044', SupportedPercentageType: '03',
  Executable: true, OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, Dependency: null, InputWitnessSha256: 'a'.repeat(64),
  NativeRecipientUniverseVerified: false, OriginalFullTaskAccepted: false, SourceSyncEnabled: false, HumanChoicesAvailable: false, CurrentSourceVerified: false, SourceParityVerified: false, NativeDateParametersVerified: false,
}
export function fenixResult(request: FenixDiscountRequest = fenixScope()): FenixDiscountResult {
  return { ...structuredClone(request), InputAvailable: true, OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, Dependency: null,
    Cells: [{ Recipient: { ...fenixClient }, RecipientName: 'Клієнт FENIX', Product: fenixProduct, ProductName: 'Товар FENIX', RegionCode: fenixRegion, Percentage: '-12.34', FactRows: 2 }],
    MaximumPercentage: '-12.34', InputWitnessSha256: 'c'.repeat(64), ResultSha256: 'd'.repeat(64), PeriodPolicy: 'DeclaredLastWholeSecond',
    SourceParityVerified: false, NativeDateParametersVerified: false, NativeStringComparisonVerified: false, AppliesFxConversion: false }
}
export function fenixEmpty(request: FenixDiscountRequest = fenixScope()): FenixDiscountResult { return { ...fenixResult(request), Cells: [], MaximumPercentage: null } }
export function fenixMissing(request: FenixDiscountRequest = fenixScope()): FenixDiscountResult {
  return { ...fenixEmpty(request), InputAvailable: false, OrdinaryPublicationAvailable: false, OurSnapshotVerified: false, Dependency: 'ordinary_fenix_discount_publication_unavailable', InputWitnessSha256: null }
}
export function fenixChoices(request: FenixDiscountRequest = fenixScope()): FenixDiscountChoices {
  return { Version: 1, World: 'fenix', SourceId: request.SourceId, DefinitionSha256: request.DefinitionSha256, Through: request.Through,
    RequestedProducts: [...request.Products], RequestedRecipients: structuredClone(request.Recipients), RequestedRegionCodes: [...request.RegionCodes],
    OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, Dependency: null, FieldAvailability: { Номенклатура: true, ПолучательСкидки: true, КодПоРегиону: true },
    Choices: { Номенклатура: [{ Field: 'Номенклатура', Type: '08', TableReference: '00000054', Key: fenixProduct, Caption: 'Товар FENIX', Deleted: false }],
      ПолучательСкидки: [{ Field: 'ПолучательСкидки', Type: '08', TableReference: '00000044', Key: fenixRecipientKey(fenixClient), Caption: 'Клієнт FENIX', Deleted: false }],
      КодПоРегиону: [{ Field: 'КодПоРегиону', Type: 'string', TableReference: null, Key: fenixRegion, Caption: fenixRegion, Deleted: false }] },
    MissingFamilies: [], InputWitnessSha256: 'a'.repeat(64), ChoicesWitnessSha256: fenixWitness, ResultSha256: 'e'.repeat(64), HumanChoicesAvailable: true,
    NativeRecipientUniverseVerified: false, CurrentSourceVerified: false, SourceParityVerified: false }
}
