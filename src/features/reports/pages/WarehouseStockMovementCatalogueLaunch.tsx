import { Button } from '@mantine/core'
import { isWarehouseMovementCatalogueEntry } from '../data/originalWarehouseMovement'
import { WAREHOUSE_STOCK_MOVEMENT_TITLE } from '../data/warehouseStockMovement'
import type { ReportCatalogueEntry } from '../types'

export type OpenStockMovement = () => boolean

export function WarehouseStockMovementCatalogueLaunch({ report, worlds, enabled, disabled, callerKey, onOpen }: {
  report: ReportCatalogueEntry; worlds: readonly string[]; enabled: boolean; disabled: boolean; callerKey: string | null; onOpen?: OpenStockMovement
}) {
  if (!isWarehouseMovementCatalogueEntry(report, worlds) || !enabled || !callerKey || !onOpen) return null
  return <Button type="button" size="compact-sm" variant="default" disabled={disabled}
    onClick={event => { event.stopPropagation(); if (!disabled) onOpen() }}>{WAREHOUSE_STOCK_MOVEMENT_TITLE}</Button>
}
