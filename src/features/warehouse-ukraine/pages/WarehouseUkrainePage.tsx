import { Badge, Box, Group, Stack } from '@mantine/core'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
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

const PKEY_INVOICES = 'STORAGES_Ukraine_Invoices_Warehouse_Ukraine_PKEY'
const PKEY_SHIPMENTS = 'STORAGES_Ukraine_Shipments_Warehouse_Ukraine_PKEY'
const PKEY_UKRAINE_ORDER = 'STORAGES_Ukraine_UkraineOrder_Warehouse_Ukraine_PKEY'

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
  render: () => ReactNode
}

export function WarehouseUkrainePage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const [editingTotal, setEditingTotal] = useValueState(0)

  useEffect(() => {
    let cancelled = false

    async function loadEditingTotal() {
      try {
        const total = await getTotalActForEditing()

        if (!cancelled) {
          setEditingTotal(total)
        }
      } catch {
        if (!cancelled) {
          setEditingTotal(0)
        }
      }
    }

    void loadEditingTotal()

    return () => {
      cancelled = true
    }
  }, [setEditingTotal])

  const tabs = useMemo<WarehouseUkraineTab[]>(
    () => [
      {
        value: TAB_SALES,
        label: t('Накладні'),
        permissionKey: PKEY_INVOICES,
        render: () => <SalesTab />,
      },
      {
        value: TAB_SHIPMENTS,
        label: t('Відвантаження'),
        permissionKey: PKEY_SHIPMENTS,
        render: () => <ShipmentsTab />,
      },
      {
        value: TAB_ORDERS,
        label: t('Замовлення на Україну'),
        permissionKey: PKEY_UKRAINE_ORDER,
        render: () => <OrdersTab />,
      },
      {
        value: TAB_EDITING,
        label: t('Протокол актів редагування накладних'),
        permissionKey: PKEY_UKRAINE_ORDER,
        showBadge: true,
        render: () => <EditingTab />,
      },
      {
        value: TAB_INVOICE_REGISTER,
        label: t('Реєстр накладних'),
        permissionKey: PKEY_UKRAINE_ORDER,
        render: () => <InvoiceRegisterTab />,
      },
      {
        value: TAB_VERIFICATION,
        label: t('Звірка'),
        permissionKey: PKEY_UKRAINE_ORDER,
        render: () => <DocumentVerificationTab />,
      },
    ],
    [t],
  )

  const visibleTabs = useMemo(() => {
    return tabs.filter((tab) => hasPermission(tab.permissionKey))
  }, [hasPermission, tabs])

  const defaultTab = visibleTabs[0]?.value ?? ''
  const [activeTab, setActiveTab] = useValueState(defaultTab)
  const activeTabItem = visibleTabs.find((tab) => tab.value === activeTab) ?? visibleTabs[0]

  usePageBreadcrumb(activeTabItem?.label ?? null)

  return (
    <Stack className="warehouse-ukraine-page console-table-page" gap={6}>
      <div className="pill-tabs">
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

      {activeTabItem && <Box className="warehouse-ukraine-tab-panel">{activeTabItem.render()}</Box>}
    </Stack>
  )
}
