type EntityIdentity = {
  Id?: number
  NetUid?: string | null
}

export function isLocalAdvanceReportEntity(entity: EntityIdentity | null | undefined): boolean {
  return !entity?.Id && (!entity?.NetUid || entity.NetUid.startsWith('local-'))
}

export function canRemoveAdvanceReportConsumableRow(
  isDone: boolean,
  entry: EntityIdentity | null | undefined,
  consumablesOrder: EntityIdentity | null | undefined,
  item: EntityIdentity | null | undefined,
): boolean {
  return (
    !isDone ||
    isLocalAdvanceReportEntity(entry) ||
    isLocalAdvanceReportEntity(consumablesOrder) ||
    isLocalAdvanceReportEntity(item)
  )
}

export function canRemoveAdvanceReportFuelRow(
  isDone: boolean,
  fueling: EntityIdentity | null | undefined,
): boolean {
  return !isDone || isLocalAdvanceReportEntity(fueling)
}
