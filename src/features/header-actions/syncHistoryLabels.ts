import { syncTypeOptions } from './syncOptions'

type SyncHistoryKind = 'daily' | 'entity'

const dailyDataSyncOperationType = 7

export function getSyncTypeLabel(type: number | undefined, historyKind: SyncHistoryKind): string {
  if (typeof type !== 'number') {
    return 'Невідомий тип'
  }

  if (historyKind === 'daily') {
    return type === dailyDataSyncOperationType ? 'Щоденна синхронізація' : 'Невідомий тип'
  }

  return syncTypeOptions.find((option) => option.value === String(type))?.label || 'Невідомий тип'
}
