import { Button, Group, Loader } from '@mantine/core'
import { lazy, Suspense, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { CatalogueLaunchChoice } from '../data/reportCatalogueLaunch'
import type { DebtToSalesRatioCapabilities } from '../data/debtToSalesRatio'
import type { CollectionCoefficientCapabilities } from '../data/collectionCoefficient'
import type { SalesMarginCapabilities } from '../data/salesMargin'
import type { CashMovementCapabilities } from '../data/cashMovement'
import type { SupplierDebtCapabilities } from '../data/supplierDebt'
import type { EmployeeGrossProfitCapabilities } from '../data/employeeGrossProfit'
import type { OverdueReceivablesCapabilities } from '../data/overdueReceivables'
import type { ManagementReturnsCapabilities } from '../data/managementReturns'
import type { ManagementBalanceCapabilities } from '../data/managementBalance'
import type { ManagementOrdersCapabilities } from '../data/managementOrders'
import type { DefectProductionCapabilities } from '../data/defectProduction'
import type { ActiveClientsCapabilities } from '../data/activeClients'
import type { CurrencyRateDynamicsCapabilities } from '../data/currencyRateDynamics'
import type { CashAggregateBalanceCapabilities } from '../data/cashAggregateBalance'
import type { OriginalRevenueCapabilities } from '../data/originalRevenue'
import type { OriginalBuyerSalesShareCapabilities } from '../data/originalBuyerSalesShare'
import type { ReportCatalogue } from '../types'

const ReportCataloguePanel = lazy(() => import('./ReportCataloguePanel').then(module => ({ default: module.ReportCataloguePanel })))

export function ReportCatalogueControl({ enabled, disabled = false, presentation = 'inline', onOpen, onOpenDebtToSalesRatio, onOpenCollectionCoefficient, onOpenSalesMargin, onOpenCashMovement, onOpenSupplierDebt, onOpenEmployeeGrossProfit, onOpenOverdueReceivables, onOpenManagementReturns, onOpenManagementBalance, onOpenManagementOrders, onOpenDefectProduction, callerKey = null, onOpenActiveClients, onOpenCurrencyRateDynamics, onOpenCashAggregateBalance, onOpenOriginalRevenue, onOpenOriginalBuyerSalesShare }: {
  enabled: boolean
  disabled?: boolean
  presentation?: 'inline' | 'dialog'
  onOpen?: (choice: CatalogueLaunchChoice, catalogue: ReportCatalogue) => boolean
  onOpenDebtToSalesRatio?: (capability: DebtToSalesRatioCapabilities) => boolean
  onOpenCollectionCoefficient?: (capability: CollectionCoefficientCapabilities) => boolean
  onOpenSalesMargin?: (capability: SalesMarginCapabilities) => boolean
  onOpenCashMovement?: (capability: CashMovementCapabilities) => boolean
  onOpenSupplierDebt?: (capability: SupplierDebtCapabilities) => boolean
  onOpenEmployeeGrossProfit?: (capability: EmployeeGrossProfitCapabilities) => boolean
  onOpenOverdueReceivables?: (capability: OverdueReceivablesCapabilities) => boolean
  onOpenManagementReturns?: (capability: ManagementReturnsCapabilities) => boolean
  onOpenManagementBalance?: (capability: ManagementBalanceCapabilities) => boolean
  onOpenManagementOrders?: (capability: ManagementOrdersCapabilities) => boolean
  onOpenDefectProduction?: (capability: DefectProductionCapabilities) => boolean
  callerKey?: string | null
  onOpenActiveClients?: (capability: ActiveClientsCapabilities) => boolean
  onOpenCurrencyRateDynamics?: (capability: CurrencyRateDynamicsCapabilities) => boolean
  onOpenCashAggregateBalance?: (capability: CashAggregateBalanceCapabilities) => boolean
  onOpenOriginalRevenue?: (capability: OriginalRevenueCapabilities) => boolean
  onOpenOriginalBuyerSalesShare?: (capability: OriginalBuyerSalesShareCapabilities) => boolean
}) {
  const { t } = useI18n()
  const [opened, setOpened] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = presentation === 'dialog'
  const canOpen = enabled && !disabled
  const panel = enabled && opened ? <Suspense fallback={<Loader size="sm" aria-label={t('Завантаження каталогу звітів')} />}>
    <ReportCataloguePanel disabled={disabled} callerKey={callerKey}
      onOpen={closeAfterAccepted(onOpen, canOpen, () => setOpened(false))}
      onOpenDebtToSalesRatio={closeAfterAccepted(onOpenDebtToSalesRatio, canOpen, () => setOpened(false))}
      onOpenCollectionCoefficient={closeAfterAccepted(onOpenCollectionCoefficient, canOpen, () => setOpened(false))}
      onOpenSalesMargin={closeAfterAccepted(onOpenSalesMargin, canOpen, () => setOpened(false))}
      onOpenCashMovement={closeAfterAccepted(onOpenCashMovement, canOpen, () => setOpened(false))}
      onOpenSupplierDebt={closeAfterAccepted(onOpenSupplierDebt, canOpen, () => setOpened(false))}
      onOpenEmployeeGrossProfit={closeAfterAccepted(onOpenEmployeeGrossProfit, canOpen, () => setOpened(false))}
      onOpenOverdueReceivables={closeAfterAccepted(onOpenOverdueReceivables, canOpen, () => setOpened(false))}
      onOpenManagementReturns={closeAfterAccepted(onOpenManagementReturns, canOpen, () => setOpened(false))}
      onOpenManagementBalance={closeAfterAccepted(onOpenManagementBalance, canOpen, () => setOpened(false))}
      onOpenManagementOrders={closeAfterAccepted(onOpenManagementOrders, canOpen, () => setOpened(false))}
      onOpenDefectProduction={closeAfterAccepted(onOpenDefectProduction, canOpen, () => setOpened(false))}
      onOpenActiveClients={closeAfterAccepted(onOpenActiveClients, canOpen, () => setOpened(false))}
      onOpenCurrencyRateDynamics={closeAfterAccepted(onOpenCurrencyRateDynamics, canOpen, () => setOpened(false))}
      onOpenCashAggregateBalance={closeAfterAccepted(onOpenCashAggregateBalance, canOpen, () => setOpened(false))}
      onOpenOriginalRevenue={closeAfterAccepted(onOpenOriginalRevenue, canOpen, () => setOpened(false))}
      onOpenOriginalBuyerSalesShare={closeAfterAccepted(onOpenOriginalBuyerSalesShare, canOpen, () => setOpened(false))} />
  </Suspense> : null
  return <>
    <Group>
      <Button ref={trigger} type="button" variant={dialog ? 'filled' : 'subtle'} disabled={!enabled || disabled}
        aria-haspopup={dialog ? 'dialog' : undefined} aria-expanded={enabled && opened}
        onClick={() => setOpened(value => !value)}>
        {!dialog && opened ? t('Сховати каталог звітів 1С') : t('Каталог усіх звітів 1С')}
      </Button>
    </Group>
    {dialog ? <AppModal opened={enabled && opened} onClose={() => setOpened(false)}
      title={t('Каталог усіх звітів 1С')} size={1280} className="report-catalogue-dialog"
      closeButtonProps={{ 'aria-label': t('Закрити каталог звітів') }} returnFocus={false}
      onExitTransitionEnd={() => trigger.current?.focus()}>
      {panel}
    </AppModal> : panel}
  </>
}

/** The catalogue closes only when its caller accepted the chosen report. */
function closeAfterAccepted<Args extends unknown[]>(action: ((...args: Args) => boolean) | undefined, enabled: boolean, close: () => void) {
  if (!action) return undefined
  return (...args: Args) => {
    if (!enabled || !action(...args)) return false
    close()
    return true
  }
}
