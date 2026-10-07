import { fenixDiscountIdentity } from '../data/originalFenixDiscountAnalysis'
import { normalizeFenixDiscountChoices, normalizeFenixDiscountReadiness, type FenixDiscountChoices } from '../data/originalFenixDiscountAnalysisChoices'
import { fenixCapability, fenixParty, fenixProduct, fenixScope, fenixWitness } from './originalFenixDiscountAnalysisFixtures'
const identity = { ...fenixDiscountIdentity, ModuleSha256: fenixCapability.ModuleSha256, QuerySha256: fenixCapability.QuerySha256,
  CurrentSourceVerified: false, NativeDateParametersVerified: false, NativeReferenceMaximumOrderingVerified: false,
  NativeTypePriorityCompatibilityVerified: false, NativeTypedPercentageMaximumVerified: false, SourceParityVerified: false, SourceSyncEnabled: false, OriginalFullTaskAccepted: false }
export const fenixChoiceWitness = 'c'.repeat(64)
export const fenixReadiness = () => normalizeFenixDiscountReadiness({ ...identity, Implemented: true, Executable: true,
  OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, NormalInputsReadinessVerified: true, Dependency: null,
  InputWitnessSha256: fenixWitness, SourceSyncEnabled: false, NativeTypedPercentageMaximumVerified: false, OriginalFullTaskAccepted: false })
export function fenixNames(): FenixDiscountChoices {
  return normalizeFenixDiscountChoices({ ...identity, Through: fenixScope().Through, RequestedCounterparties: [], RequestedProducts: [],
    OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, Dependency: null, FieldAvailability: { Контрагент: true, Номенклатура: true },
    Choices: { Контрагент: [{ Field: 'Контрагент', Type: '08', TableReference: '00000044', Reference: fenixParty, Caption: 'Клієнт Fenix', Deleted: false,
      MetadataObjectId: 'b6412cac-a3e5-4c01-b215-6903507b9229', SourceReferenceTypeId: '47e6dd42-cd5c-4e3a-9bc4-14816ed53d38', PhysicalTable: '_Reference68' }],
    Номенклатура: [{ Field: 'Номенклатура', Type: '08', TableReference: '00000054', Reference: fenixProduct, Caption: 'Товар Fenix', Deleted: false,
      MetadataObjectId: '22d218e8-ed66-4c7c-9e9f-3a9e5c99ab15', SourceReferenceTypeId: '44a01d39-c2b6-4751-85e6-06fdc2f23043', PhysicalTable: '_Reference84' }] },
    MissingFamilies: [], HumanChoicesAvailable: true, InputWitnessSha256: fenixWitness, ChoicesWitnessSha256: fenixChoiceWitness, ResultSha256: 'd'.repeat(64) }, fenixScope())
}
