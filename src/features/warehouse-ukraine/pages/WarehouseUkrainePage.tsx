import { Badge, Group, Stack, Tabs, Text } from '@mantine/core'
import {
  IconChecklist,
  IconEdit,
  IconFileInvoice,
  IconPackage,
  IconReceipt,
  IconTruck,
} from '@tabler/icons-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getTotalActForEditing } from '../api/shellApi'
import { DocumentVerificationTab } from '../components/DocumentVerificationTab'
import { EditingTab } from '../components/EditingTab'
import { InvoiceRegisterTab } from '../components/InvoiceRegisterTab'
import { OrdersTab } from '../components/OrdersTab'
import { SalesTab } from '../components/SalesTab'
import { ShipmentsTab } from '../components/ShipmentsTab'

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
  icon: ReactNode
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
        icon: <IconFileInvoice size={16} />,
        permissionKey: PKEY_INVOICES,
        render: () => <SalesTab />,
      },
      {
        value: TAB_SHIPMENTS,
        label: t('Відвантаження'),
        icon: <IconTruck size={16} />,
        permissionKey: PKEY_SHIPMENTS,
        render: () => <ShipmentsTab />,
      },
      {
        value: TAB_ORDERS,
        label: t('Замовлення на Україну'),
        icon: <IconPackage size={16} />,
        permissionKey: PKEY_UKRAINE_ORDER,
        render: () => <OrdersTab />,
      },
      {
        value: TAB_EDITING,
        label: t('Протокол актів редагування накладних'),
        icon: <IconEdit size={16} />,
        permissionKey: PKEY_UKRAINE_ORDER,
        showBadge: true,
        render: () => <EditingTab />,
      },
      {
        value: TAB_INVOICE_REGISTER,
        label: t('Реєстр накладних'),
        icon: <IconReceipt size={16} />,
        permissionKey: PKEY_UKRAINE_ORDER,
        render: () => <InvoiceRegisterTab />,
      },
      {
        value: TAB_VERIFICATION,
        label: t('Звірка'),
        icon: <IconChecklist size={16} />,
        permissionKey: PKEY_UKRAINE_ORDER,
        render: () => <DocumentVerificationTab />,
      },
    ],
    [t],
  )

  const visibleTabs = useMemo(() => {
    const permitted = tabs.filter((tab) => hasPermission(tab.permissionKey))

    return permitted.length > 0 ? permitted : tabs
  }, [hasPermission, tabs])

  const defaultTab = visibleTabs[0].value

  return (
    <Stack gap="md">
      <Text fw={700} size="xl">
        {t('Склад Україна')}
      </Text>

      <Tabs defaultValue={defaultTab} keepMounted={false}>
        <Tabs.List>
          {visibleTabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
              <Group gap={6}>
                {tab.label}
                {tab.showBadge && editingTotal > 0 && (
                  <Badge color="violet" size="sm" variant="light">
                    {editingTotal}
                  </Badge>
                )}
              </Group>
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {visibleTabs.map((tab) => (
          <Tabs.Panel key={tab.value} value={tab.value} pt="md">
            {tab.render()}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  )
}
