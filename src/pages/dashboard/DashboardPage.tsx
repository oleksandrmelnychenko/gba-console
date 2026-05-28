import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconArrowRight,
  IconLayoutDashboard,
  IconRoute,
  IconServer2,
  IconShieldCheck,
} from '@tabler/icons-react'
import { useMemo, type ComponentType } from 'react'
import { useI18n } from '../../shared/i18n/useI18n'
import type { TranslationKey } from '../../shared/i18n/types'
import { DataTable } from '../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../shared/ui/data-table/types'

type StatItem = {
  label: TranslationKey
  value?: string
  valueKey?: TranslationKey
  detail: TranslationKey
  icon: ComponentType<{ size?: number; stroke?: number }>
}

type MigrationRow = {
  area: TranslationKey
  owner: TranslationKey | 'CRM'
  status: TranslationKey
  progress: number
}

const stats: StatItem[] = [
  { label: 'Активні модулі', value: '5', detail: 'Обсяг консолі', icon: IconLayoutDashboard },
  { label: 'API напрями', value: '2', detail: 'Concord та аналітика', icon: IconServer2 },
  { label: 'Групи маршрутів', value: '149', detail: 'CRM інвентар', icon: IconRoute },
  { label: 'Базова збірка', valueKey: 'Готово', detail: 'Резерв зі старого клієнта', icon: IconShieldCheck },
]

const migrationRows: MigrationRow[] = [
  { area: 'Оболонка панелі', owner: 'Консоль', status: 'Готово', progress: 100 },
  { area: 'Авторизація', owner: 'Ядро', status: 'Готово', progress: 100 },
  { area: 'Список клієнтів', owner: 'CRM', status: 'Наступний', progress: 0 },
  { area: 'Замовлення постачання', owner: 'Логістика', status: 'У черзі', progress: 0 },
]

const MIGRATION_TABLE_DEFAULT_LAYOUT = {
  density: 'normal',
} satisfies DataTableDefaultLayout

export function DashboardPage() {
  const { t } = useI18n()
  const migrationColumns = useMemo<DataTableColumn<MigrationRow>[]>(
    () => [
      {
        id: 'area',
        header: 'Зона',
        accessor: (row) => t(row.area),
        minWidth: 180,
      },
      {
        id: 'owner',
        header: 'Власник',
        accessor: (row) => row.owner === 'CRM' ? row.owner : t(row.owner),
        width: 140,
      },
      {
        id: 'status',
        header: 'Статус',
        accessor: (row) => t(row.status),
        width: 140,
        cell: (row) => (
          <Badge color={row.status === 'Готово' ? 'violet' : 'gray'} variant="light">
            {t(row.status)}
          </Badge>
        ),
      },
      {
        id: 'progress',
        header: 'Прогрес',
        accessor: (row) => row.progress,
        minWidth: 170,
        cell: (row) => <Progress value={row.progress} color="violet" size="sm" radius="xl" />,
      },
    ],
    [t],
  )

  return (
    <Stack gap="lg">
      <Group justify="flex-end" align="end">
        <Button rightSection={<IconArrowRight size={16} />} color="violet">
          {t('Відкрити наступний модуль')}
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {stats.map((item) => (
          <Card key={item.label} withBorder radius="md" padding="lg">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Box>
                <Text size="sm" c="dimmed">
                  {t(item.label)}
                </Text>
                <Title order={3} mt={4}>
                  {item.valueKey ? t(item.valueKey) : item.value}
                </Title>
                <Text size="xs" c="dimmed" mt={6}>
                  {t(item.detail)}
                </Text>
              </Box>
              <ThemeIcon variant="light" color="violet" size={40} radius="md">
                <item.icon size={21} stroke={1.8} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        <Card withBorder radius="md" padding="lg" className="wide-card">
          <Group justify="space-between" mb="md">
            <Box>
              <Title order={3} size="h4">
                {t('Черга перенесення')}
              </Title>
              <Text size="sm" c="dimmed">
                {t('Поступове перенесення маршрутів у консоль')}
              </Text>
            </Box>
            <Badge color="violet" variant="light">
              {t('активно')}
            </Badge>
          </Group>

          <DataTable
            columns={migrationColumns}
            data={migrationRows}
            defaultLayout={MIGRATION_TABLE_DEFAULT_LAYOUT}
            getRowId={(row) => row.area}
            layoutVersion="dashboard-migration-table-1"
            minWidth={640}
            tableId="dashboard-migration"
          />
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Stack align="center" gap="sm">
            <RingProgress
              size={160}
              thickness={14}
              roundCaps
              sections={[{ value: 50, color: 'violet' }]}
              label={
                <Text ta="center" fw={700} size="xl">
                  50%
                </Text>
              }
            />
            <Title order={3} size="h4" ta="center">
              {t('Готовність консолі')}
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              {t('Оболонка, деплой, логін і шлях даних футера.')}
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
