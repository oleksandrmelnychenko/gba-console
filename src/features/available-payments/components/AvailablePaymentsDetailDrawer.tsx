import { Alert, Badge, Group, Stack, Table, Text } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TaskStatusValue, type GroupedPaymentTask, type SupplyPaymentTask } from '../types'

type AvailablePaymentsDetailDrawerProps = {
  group: GroupedPaymentTask | null
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

export function AvailablePaymentsDetailDrawer({ group, onClose }: AvailablePaymentsDetailDrawerProps) {
  const { t } = useI18n()
  const tasks = group?.SupplyPaymentTasks || []

  return (
    <AppDrawer
      opened={Boolean(group)}
      position="right"
      size="xl"
      title={t('Наявні платежі')}
      onClose={onClose}
    >
      <Stack gap="md">
        <Group gap="xs">
          <Text fw={600}>{t('Дата')}:</Text>
          <Text>{formatDate(group?.PayToDate)}</Text>
        </Group>

        <Alert color="blue" icon={<IconInfoCircle size={18} />} variant="light">
          {t('Редагування платіжних задач доступне у класичному інтерфейсі')}
        </Alert>

        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>{t('Статус')}</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>{t('Сума')}</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>{t('Вся сума в EUR')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tasks.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" size="sm">
                    {t('Платіжних задач не знайдено')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              tasks.map((task, index) => (
                <Table.Tr key={task.NetUid || task.Id || index}>
                  <Table.Td>
                    <Text c="dimmed" size="sm">
                      {index + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td>{renderStatus(task, t)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatAmount(task.GrossPrice)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatAmount(task.EuroGrossPrice)}</Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </AppDrawer>
  )
}

function renderStatus(task: SupplyPaymentTask, t: (key: string) => string) {
  if (task.TaskStatus === TaskStatusValue.Done) {
    return (
      <Badge color="green" variant="light">
        {t('Виконано')}
      </Badge>
    )
  }

  if (task.TaskStatus === TaskStatusValue.PartiallyDone) {
    return (
      <Badge color="yellow" variant="light">
        {t('Оплачено частково')}
      </Badge>
    )
  }

  return (
    <Badge color="gray" variant="light">
      {t('Не завершено')}
    </Badge>
  )
}

function formatDate(value?: Date | string): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

function formatAmount(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-'
  }

  return value.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
