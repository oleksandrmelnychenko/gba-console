import { type PlannedFlowChoices } from '../data/originalPlannedCashFlow'
import { flowCapability, flowResult } from './originalPlannedCashClientFixtures'
export const namedFlowCapability = { ...flowCapability, ScopedChoicesImplemented: true }
export const scenarioKey = 'A'.repeat(32)
export function plannedFlowChoices(): PlannedFlowChoices {
  const base = flowResult()
  return { Version: 1, World: 'fenix', SourceId: base.SourceId, DefinitionSha256: base.DefinitionSha256, From: base.From, Through: base.Through,
    RequestedScenarios: [], RequestedProjects: [], RequestedDepartments: [], Measures: [...base.Measures], Available: true, Code: 'available',
    FullParentScopeVerified: true, OurSnapshotVerified: true, ChoicesWitnessSha256: 'c'.repeat(64),
    Fields: [{ Field: 'Scenarios', Available: true, Code: 'available', Choices: [{ Value: scenarioKey, Caption: 'Наш сценарій' }] },
      { Field: 'Projects', Available: false, Code: 'planning_name_catalogue_unavailable', Choices: [] },
      { Field: 'Departments', Available: false, Code: 'planning_name_catalogue_unavailable', Choices: [] }],
    HumanChoicesAvailable: true, AppliesFxConversion: false, SourceParityVerified: false, OriginalFullTaskAccepted: false }
}
