import { amgDiscountAnalysisIdentity } from '../data/originalAmgDiscountAnalysis'
import { normalizeAmgDiscountAnalysisChoices, normalizeAmgDiscountAnalysisReadiness, type AmgDiscountAnalysisChoices } from '../data/originalAmgDiscountAnalysisChoices'
import { amgCapability, amgParty, amgProduct, amgScope, amgWitness } from './originalAmgDiscountAnalysisFixtures'
const identity = { ...amgDiscountAnalysisIdentity, ModuleSha256: amgCapability.ModuleSha256, QuerySha256: amgCapability.QuerySha256,
  CurrentSourceVerified: false, NativeDateParametersVerified: false, NativeReferenceMaximumOrderingVerified: false,
  NativeTypePriorityCompatibilityVerified: false, NativeTypedPercentageMaximumVerified: false, SourceParityVerified: false, SourceSyncEnabled: false, OriginalFullTaskAccepted: false }
export const amgChoiceWitness = 'c'.repeat(64)
export const amgReadiness = () => normalizeAmgDiscountAnalysisReadiness({ ...identity, Implemented: true, Executable: true,
  OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, NormalInputsReadinessVerified: true, Dependency: null,
  InputWitnessSha256: amgWitness, SourceSyncEnabled: false, NativeTypedPercentageMaximumVerified: false, OriginalFullTaskAccepted: false })
export function amgNames(): AmgDiscountAnalysisChoices {
  return normalizeAmgDiscountAnalysisChoices({ ...identity, Through: amgScope().Through, RequestedCounterparties: [], RequestedProducts: [],
    OrdinaryPublicationAvailable: true, OurSnapshotVerified: true, Dependency: null, FieldAvailability: { Контрагент: true, Номенклатура: true },
    Choices: { Контрагент: [{ Field: 'Контрагент', Type: '08', TableReference: '0000005A', Reference: amgParty, Caption: 'Клієнт AMG', Deleted: false,
      MetadataObjectId: 'b6412cac-a3e5-4c01-b215-6903507b9229', SourceReferenceTypeId: '47e6dd42-cd5c-4e3a-9bc4-14816ed53d38', PhysicalTable: '_Reference90' }],
    Номенклатура: [{ Field: 'Номенклатура', Type: '08', TableReference: '0000006C', Reference: amgProduct, Caption: 'Товар AMG', Deleted: false,
      MetadataObjectId: '22d218e8-ed66-4c7c-9e9f-3a9e5c99ab15', SourceReferenceTypeId: '44a01d39-c2b6-4751-85e6-06fdc2f23043', PhysicalTable: '_Reference108' }] },
    MissingFamilies: [], ReferenceCoverageVerified: true, HumanChoicesAvailable: true, InputWitnessSha256: amgWitness, ChoicesWitnessSha256: amgChoiceWitness, ResultSha256: 'd'.repeat(64) }, amgScope())
}
