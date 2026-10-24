import fixture from './originalWarehouseMovement.fixture.json'
import type { MovementCapability, MovementPublication, MovementRequest, MovementResult } from './originalWarehouseMovement'
// Real offline server fold/serializer response; source references, names and document numbers anonymized.
export const movementFixture = fixture as MovementResult
export const movementPublication: MovementPublication = { Capture: fixture.Capture, Products: [{ Reference: 'A'.repeat(32), Article: 'TEST-ARTICLE', Name: 'Тестовий товар', Unit: 'шт' }],
  Warehouses: fixture.Rows.map(row => ({ Reference: row.SourceWarehouseReference, Name: row.Caption })) }
export const movementRequest: MovementRequest = { Version: 1, ...movementFixture.Scope }
export const movementCapability: MovementCapability = { Version: 1, World: 'fenix', Executable: true, MinimumFrom: '2025-01-01', MaximumInclusiveDays: 366, MaximumWarehouses: 32,
  Rows: ['SourceWarehouse', 'CurrentArticle', 'MovementRegistrar'], Measures: ['Opening', 'Incoming', 'Outgoing', 'Closing'], ExactSingleArticleRequired: true, CompleteOpeningAndJournalRequired: true,
  SourceParityVerified: false, OriginalFullTaskAccepted: false }
