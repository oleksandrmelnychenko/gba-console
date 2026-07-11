import { Group, SimpleGrid, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import {
  ArrowRight,
  Banknote,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  FileCheck2,
  PackageCheck,
  ReceiptText,
  Route,
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../../navigation/hooks/useNavigation'
import { isNavigationPathAllowed } from '../../navigation/navigationUtils'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { DashboardWorkspaceKey } from '../types'

type WorkspaceAction = {
  icon: LucideIcon
  label: string
  route: string
}

const workspaceActions: Partial<Record<DashboardWorkspaceKey, WorkspaceAction[]>> = {
  logistics: [
    { icon: Truck, label: 'Замовлення на Україну', route: '/orders/ukraine/all' },
    { icon: ClipboardList, label: 'Протоколи поставок', route: '/product-delivery-protocols' },
    { icon: PackageCheck, label: 'Документи приходу', route: '/products/income/documents' },
    { icon: FileCheck2, label: 'Складські накладні', route: '/warehouse/ukraine' },
  ],
  warehouse: [
    { icon: Boxes, label: 'Склад Україна', route: '/warehouse/ukraine' },
    { icon: PackageCheck, label: 'Розміщення товарів', route: '/products/placements' },
    { icon: Route, label: 'Переміщення товарів', route: '/products/transfers' },
    { icon: ClipboardList, label: 'Оприходування', route: '/products/capitalization' },
    { icon: ReceiptText, label: 'Повернення постачальнику', route: '/supplies/returns' },
  ],
  accounting: [
    { icon: Banknote, label: 'Рух коштів', route: '/accounting/income-cashflows' },
    { icon: CircleDollarSign, label: 'Вихідні платежі', route: '/accounting/outgoing-cashflow' },
    { icon: FileCheck2, label: 'Акти звірки', route: '/ukraine/act/reconcoliation' },
    { icon: ReceiptText, label: 'Доступні платежі', route: '/accounting/available-payments' },
  ],
  finance: [
    { icon: Banknote, label: 'Рух коштів', route: '/accounting/income-cashflows' },
    { icon: CircleDollarSign, label: 'Вихідні платежі', route: '/accounting/outgoing-cashflow' },
    { icon: ReceiptText, label: 'Баланси', route: '/accounting/sync/documents' },
    { icon: FileCheck2, label: 'Акти звірки', route: '/ukraine/act/reconcoliation' },
  ],
  executive: [
    { icon: CircleDollarSign, label: 'Продажі', route: '/sales/ukraine/all' },
    { icon: Boxes, label: 'Аналітика асортименту', route: '/products/assortment' },
    { icon: Users, label: 'Клієнти', route: '/clients' },
    { icon: Truck, label: 'Замовлення', route: '/orders/ukraine/all' },
  ],
  driver: [
    { icon: Truck, label: 'Складські накладні', route: '/warehouse/ukraine' },
  ],
  client: [
    { icon: Users, label: 'Клієнти', route: '/clients' },
    { icon: ReceiptText, label: 'Продажі', route: '/sales/ukraine/all' },
  ],
}

export function OperationsWorkspace({ workspaceKey }: { workspaceKey: DashboardWorkspaceKey }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { modules } = useNavigation()
  const actions = useMemo(
    () => (workspaceActions[workspaceKey] ?? []).filter((action) => isNavigationPathAllowed(modules, action.route)),
    [modules, workspaceKey],
  )

  return (
    <div className="role-dashboard-operations">
      <Text className="app-section-title" fw={700} mb="sm">{t('Робочі черги')}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        {actions.map((action) => (
          <UnstyledButton key={action.route} className="role-dashboard-action" onClick={() => navigate(action.route)}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon color="gray" size={34} variant="light"><action.icon size={18} /></ThemeIcon>
                <Text fw={650} size="sm">{t(action.label)}</Text>
              </Group>
              <ArrowRight size={17} />
            </Group>
          </UnstyledButton>
        ))}
      </SimpleGrid>
      {actions.length === 0 && (
        <Group gap="xs" mt="sm"><ShieldCheck size={18} /><Text c="dimmed" size="sm">{t('Немає доступних робочих черг')}</Text></Group>
      )}
    </div>
  )
}
