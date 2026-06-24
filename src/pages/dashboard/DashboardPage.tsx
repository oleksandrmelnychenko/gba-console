import {
  Box,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core'
import {
  IconBasket,
  IconBuildingStore,
  IconChartBar,
  IconChevronRight,
  IconFileAnalytics,
  IconPackage,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react'
import { useMemo, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '../../features/navigation/hooks/useNavigation'
import { isNavigationPathAllowed } from '../../features/navigation/navigationUtils'
import { useI18n } from '../../shared/i18n/useI18n'
import type { TranslationKey } from '../../shared/i18n/types'

type DashboardAction = {
  color: string
  description: TranslationKey
  icon: ComponentType<{ size?: number; stroke?: number }>
  label: TranslationKey
  route: string
}

const dashboardActions: DashboardAction[] = [
  {
    color: 'teal',
    description: 'Рахунки, відвантаження, повернення',
    icon: IconBasket,
    label: 'Продажі Україна',
    route: '/sales/ukraine/all',
  },
  {
    color: 'cyan',
    description: 'Наявність, розміщення, історія руху',
    icon: IconPackage,
    label: 'Товари',
    route: '/products',
  },
  {
    color: 'indigo',
    description: 'Прихід, інвойси, специфікації',
    icon: IconTruckDelivery,
    label: 'Замовлення постачання',
    route: '/orders/ukraine/all',
  },
  {
    color: 'grape',
    description: 'Приймання, пакування, склади',
    icon: IconBuildingStore,
    label: 'Склад Україна',
    route: '/warehouse/ukraine',
  },
  {
    color: 'blue',
    description: 'Клієнти, виробники, організації',
    icon: IconUsers,
    label: 'Клієнти',
    route: '/clients',
  },
  {
    color: 'orange',
    description: 'Рейтинги, запас, маржа, повернення',
    icon: IconChartBar,
    label: 'Аналітика асортименту',
    route: '/products/assortment',
  },
  {
    color: 'gray',
    description: 'Платежі, звіти, взаєморозрахунки',
    icon: IconFileAnalytics,
    label: 'Облік',
    route: '/accounting/available-payments',
  },
]

export function DashboardPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { error, isLoading, modules } = useNavigation()
  const visibleActions = useMemo(
    () => dashboardActions.filter((action) => isNavigationPathAllowed(modules, action.route)),
    [modules],
  )

  return (
    <Stack className="dashboard-page" gap="md">
      <Group className="dashboard-heading" justify="space-between" align="flex-end">
        <Box className="dashboard-heading-copy">
          <Title order={1}>{t('Робочий простір')}</Title>
          <Text c="dimmed" size="sm">
            {t('Основні розділи консолі')}
          </Text>
        </Box>
      </Group>

      {isLoading ? (
        <DashboardStateCard title={t('Меню завантажується')} />
      ) : error ? (
        <DashboardStateCard title={t('Меню недоступне')} />
      ) : visibleActions.length === 0 ? (
        <DashboardStateCard title={t('Немає доступних розділів')} />
      ) : (
        <SimpleGrid className="dashboard-actions-grid" cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {visibleActions.map((action) => (
            <UnstyledButton
              key={action.route}
              className="dashboard-action-card"
              type="button"
              onClick={() => navigate(action.route)}
            >
              <Group align="flex-start" justify="space-between" gap="md" wrap="nowrap">
                <Group align="flex-start" gap="sm" wrap="nowrap" className="dashboard-action-main">
                  <ThemeIcon color={action.color} radius="md" size={42} variant="light">
                    <action.icon size={22} stroke={1.8} />
                  </ThemeIcon>
                  <Box className="dashboard-action-copy">
                    <Text fw={700}>{t(action.label)}</Text>
                    <Text c="dimmed" size="sm">
                      {t(action.description)}
                    </Text>
                  </Box>
                </Group>
                <ThemeIcon className="dashboard-action-arrow" color="gray" radius="xl" size={30} variant="subtle">
                  <IconChevronRight size={18} stroke={1.9} />
                </ThemeIcon>
              </Group>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}

function DashboardStateCard({ title }: { title: string }) {
  return (
    <Card className="dashboard-state-card" withBorder radius="md" padding="lg">
      <Text fw={700}>{title}</Text>
    </Card>
  )
}
