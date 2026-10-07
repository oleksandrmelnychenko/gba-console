// Synthetic wire only; no current saved owner record or publication is represented.
import { amgDiscountVariantScope, type AmgDiscountVariant } from '../data/originalAmgDiscountAnalysisVariants'
import { amgScope, amgParty, amgProduct } from './originalAmgDiscountAnalysisFixtures'
export const amgVariantId = '00000000-0000-0000-0000-000000000001'
export const amgVariant = (): AmgDiscountVariant => ({ Id: amgVariantId, Revision: 1, Name: 'Мій AMG', UpdatedAtUtc: '2026-10-05T01:02:03.000Z',
  VariantSha256: 'e'.repeat(64), RequiresFreshChoices: true, Scope: amgDiscountVariantScope({ ...amgScope(), Counterparties: [amgParty], Products: [amgProduct] }) })
export const amgVariantList = () => ({ StorageAvailable: true, Dependency: null, Items: [amgVariant()] })
