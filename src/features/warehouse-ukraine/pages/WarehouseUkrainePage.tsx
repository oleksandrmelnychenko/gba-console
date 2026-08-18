import { Alert, Badge, Box, Group, Stack } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { usePageBreadcrumb } from '../../../shared/ui/page-header-actions/pageHeaderActionsContext'
import { getTotalActForEditing } from '../api/shellApi'
import { DocumentVerificationTab } from '../components/DocumentVerificationTab'
import { EditingTab } from '../components/EditingTab'
import { InvoiceRegisterTab } from '../components/InvoiceRegisterTab'
import { OrdersTab } from '../components/OrdersTab'
import { SalesTab } from '../components/SalesTab'
import { ShipmentsTab } from '../components/ShipmentsTab'
import './warehouse-ukraine-page.css'
import '../../../shared/ui/console-table-page.css'

const PKEY_INVOICES = PermissionKeys.Warehouses.Ukraine.Invoices.Open
const PKEY_SHIPMENTS = PermissionKeys.Warehouses.Ukraine.Shipments.Open
const PKEY_UKRAINE_ORDER = PermissionKeys.Warehouses.Ukraine.Orders.Open

const TAB_SALES = 'sales'
const TAB_SHIPMENTS = 'shipments'
const TAB_ORDERS = 'orders'
const TAB_EDITING = 'editing'
const TAB_INVOICE_REGISTER = 'invoice-register'
const TAB_VERIFICATION = 'verification'

type WarehouseUkraineTab = {
  value: string
  label: string
  permissionKey: string
  showBadge?: boolean
}

export function WarehouseUkrainePage() {
  return (
    <PermissionGate permissionKey={PermissionKeys.Warehouses.Ukraine.Page.View} fallback={<WarehouseUkrainePermissionDenied />}>
      <WarehouseUkrainePageContent />
    </PermissionGate>
  )
}

function WarehouseUkrainePermissionDenied() {
  const { t } = useI18n()

  return (
    <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
      {t('У вашої ролі немає права переглядати склад Україна.')}
    </Alert>
  )
}

function WarehouseUkrainePageContent() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [editingTotal, setEditingTotal] = useValueState(0)

  const reloadEditingTotal = useCallback(async () => {
    try {
      setEditingTotal(await getTotalActForEditing())
    } catch {
      setEditingTotal(0)
    }
  }, [setEditingTotal])

  useEffect(() => {
    void reloadEditingTotal()
  }, [reloadEditingTotal])

  const tabs = useMemo<WarehouseUkraineTab[]>(
    () => [
      {
        value: TAB_SALES,
        label: t('Накладні'),
        permissionKey: PKEY_INVOICES,
      },
      {
        value: TAB_SHIPMENTS,
        label: t('Відвантаження'),
        permissionKey: PKEY_SHIPMENTS,
      },
      {
        value: TAB_ORDERS,
        label: t('Замовлення на Україну'),
        permissionKey: PKEY_UKRAINE_ORDER,
      },
      {
        value: TAB_EDITING,
        label: t('Протокол актів редагування накладних'),
        permissionKey: PKEY_UKRAINE_ORDER,
        showBadge: true,
      },
      {
        value: TAB_INVOICE_REGISTER,
        label: t('Реєстр накладних'),
        permissionKey: PKEY_UKRAINE_ORDER,
      },
      {
        value: TAB_VERIFICATION,
        label: t('Звірка'),
        permissionKey: PKEY_UKRAINE_ORDER,
      },
    ],
    [t],
  )

  const visibleTabs = useMemo(() => {
    return tabs.filter((tab) => hasPermission(tab.permissionKey))
  }, [hasPermission, tabs])

  const defaultTab = visibleTabs[0]?.value ?? ''
  const [activeTab, setActiveTab] = useValueState(defaultTab)
  const [shipmentCreateRequest, setShipmentCreateRequest] = useValueState(0)
  const activeTabItem = visibleTabs.find((tab) => tab.value === activeTab) ?? visibleTabs[0]
  const resolvedActiveValue = activeTabItem?.value ?? ''

  // Keep-alive: a tab is mounted on its first activation and then kept mounted (hidden with CSS) so
  // its filter/grid state survives tab switches — legacy persisted this in redux. Only visited tabs
  // mount, so entering the screen still loads just the default tab (no all-tabs load on open).
  const [mountedTabs, setMountedTabs] = useValueState<Set<string>>(() => new Set(resolvedActiveValue ? [resolvedActiveValue] : []))

  useEffect(() => {
    if (resolvedActiveValue && !mountedTabs.has(resolvedActiveValue)) {
      setMountedTabs((current) => new Set(current).add(resolvedActiveValue))
    }
  }, [resolvedActiveValue, mountedTabs, setMountedTabs])

  usePageBreadcrumb(activeTabItem?.label ?? null)

  const openShipmentCreation = useCallback(() => {
    setShipmentCreateRequest((current) => current + 1)
    setActiveTab(TAB_SHIPMENTS)
  }, [setActiveTab, setShipmentCreateRequest])

  const renderTab = (tabValue: string): ReactNode => {
    switch (tabValue) {
      case TAB_SALES:
        return (
          <SalesTab
            canCreateShipment={hasPermission(PKEY_SHIPMENTS)}
            onCreateShipment={openShipmentCreation}
          />
        )
      case TAB_SHIPMENTS:
        return (
          <ShipmentsTab
            key={shipmentCreateRequest}
            createRequest={shipmentCreateRequest}
          />
        )
      case TAB_ORDERS:
        return <OrdersTab />
      case TAB_EDITING:
        return <EditingTab onCountChanged={reloadEditingTotal} />
      case TAB_INVOICE_REGISTER:
        return <InvoiceRegisterTab />
      case TAB_VERIFICATION:
        return <DocumentVerificationTab />
      default:
        return null
    }
  }

  return (
    <Stack className="warehouse-ukraine-page console-table-page" gap={6}>
      <div className="warehouse-ukraine-shell console-table-shell">
        <div className="warehouse-ukraine-tabs pill-tabs">
          {visibleTabs.map((tab) => {
            const isActive = tab.value === activeTabItem?.value

            return (
              <button
                key={tab.value}
                type="button"
                className={`pill-tab${isActive ? ' is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.value)}
              >
                <Group gap={6} wrap="nowrap" align="center">
                  {tab.label}
                  {tab.showBadge && editingTotal > 0 && (
                    <Badge className="app-role-pill is-orange" size="sm" variant="light">
                      {editingTotal}
                    </Badge>
                  )}
                </Group>
              </button>
            )
          })}
        </div>

        {visibleTabs.map((tab) =>
          mountedTabs.has(tab.value) ? (
            <Box
              key={tab.value}
              className="warehouse-ukraine-tab-panel"
              style={tab.value === resolvedActiveValue ? undefined : { display: 'none' }}
            >
              {renderTab(tab.value)}
            </Box>
          ) : null,
        )}
      </div>
    </Stack>
  )
}
