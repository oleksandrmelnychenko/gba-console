import { groupedSettlementDataset } from './groupedSettlementPeriod.test-fixtures'

export const groupId = (value: number) => value.toString(16).padStart(32, '0').toUpperCase()
export const groupCapability = { Version: 1, SourceWorld: 'fenix', MaximumGroupIds: 64,
  UsesCurrentCapturedHierarchy: true, ExclusionsTakePrecedence: true, GroupIdFormat: '32 hexadecimal characters (16 bytes)' }
export const groupDataset = { ...groupedSettlementDataset, sourceCounterpartyGroups: groupCapability }
export const groupSelection = { Version: 1, SourceWorld: 'fenix', IncludeGroupIds: [groupId(1)], ExcludeGroupIds: [groupId(2)] }
