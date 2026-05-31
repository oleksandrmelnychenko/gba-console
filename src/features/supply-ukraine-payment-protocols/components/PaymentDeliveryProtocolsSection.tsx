import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import type {
  NewPaymentProtocolFormValues,
  ProtocolUser,
  SupplyOrderUkrainePaymentDeliveryProtocol,
  SupplyOrderUkrainePaymentDeliveryProtocolKey,
} from '../types'
import { formatDate, formatMoney, responsibleName } from './helpers'
import { fromDateInput, toDateInput } from './helpers'

function ProtocolRow({
  onRemove,
  protocol,
}: {
  onRemove: () => void
  protocol: SupplyOrderUkrainePaymentDeliveryProtocol
}) {
  const { t } = useI18n()
  const task = protocol.SupplyPaymentTask

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={700}>{protocol.SupplyOrderUkrainePaymentDeliveryProtocolKey?.Key || t('Платіжні задачі')}</Text>
          <Tooltip label={t('Видалити')}>
            <ActionIcon color="red" variant="subtle" onClick={onRemove}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            {t('Вартість Брутто')}
          </Text>
          <Text fw={500} size="sm">
            {formatMoney(protocol.Value)}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            {t('Вид витрати')}
          </Text>
          <Text fw={500} size="sm">
            {protocol.IsAccounting ? t('Бух. витрата') : t('Упр. витрата')}
          </Text>
        </Group>

        {task && (
          <Stack gap={2}>
            <Text size="sm">{responsibleName(task.User) || '-'}</Text>
            <Text c="dimmed" size="xs">
              {t('Сплатити до')}: {formatDate(task.PayToDate)}
            </Text>
            {task.Comment && (
              <Text c="dimmed" size="xs">
                {task.Comment}
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}

export function PaymentDeliveryProtocolsSection({
  isSaving,
  onCreateProtocol,
  onRemoveProtocol,
  protocolKeys,
  protocols,
  users,
}: {
  isSaving: boolean
  onCreateProtocol: (values: NewPaymentProtocolFormValues) => Promise<void>
  onRemoveProtocol: (protocol: SupplyOrderUkrainePaymentDeliveryProtocol) => Promise<void>
  protocolKeys: SupplyOrderUkrainePaymentDeliveryProtocolKey[]
  protocols: SupplyOrderUkrainePaymentDeliveryProtocol[]
  users: ProtocolUser[]
}) {
  const { t } = useI18n()
  const [isFormOpen, setFormOpen] = useValueState(false)
  const [removeTarget, setRemoveTarget] = useValueState<SupplyOrderUkrainePaymentDeliveryProtocol | null>(null)
  const [value, setValue] = useValueState('')
  const [protocolKey, setProtocolKey] = useValueState<SupplyOrderUkrainePaymentDeliveryProtocolKey | null>(null)
  const [responsible, setResponsible] = useValueState<ProtocolUser | null>(null)
  const [payToDate, setPayToDate] = useValueState<Date | null>(new Date())
  const [comment, setComment] = useValueState('')
  const [isAccounting, setAccounting] = useValueState(false)
  const [validationError, setValidationError] = useValueState<string | null>(null)
  const [prevOpened, setPrevOpened] = useValueState(isFormOpen)

  if (isFormOpen !== prevOpened) {
    setPrevOpened(isFormOpen)

    if (isFormOpen) {
      setValue('')
      setProtocolKey(protocolKeys[0] || null)
      setResponsible(users[0] || null)
      setPayToDate(new Date())
      setComment('')
      setAccounting(false)
      setValidationError(null)
    }
  }

  const visibleProtocols = protocols.filter((protocol) => !protocol.Deleted)
  const keyOptions = protocolKeys
    .filter((key) => key.NetUid && key.Key)
    .map((key) => ({ label: key.Key || '', value: key.NetUid || '' }))
  const userOptions = users
    .filter((user) => user.NetUid)
    .map((user) => ({ label: responsibleName(user) || user.FullName || '', value: user.NetUid || '' }))

  async function handleSubmit() {
    if (!value || Number(value) <= 0) {
      setValidationError(t('Введіть вартість брутто'))

      return
    }

    setValidationError(null)
    await onCreateProtocol({
      comment,
      isAccounting,
      payToDate,
      protocolKey,
      responsible,
      value,
    })
    setFormOpen(false)
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) {
      return
    }

    await onRemoveProtocol(removeTarget)
    setRemoveTarget(null)
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Протоколи доставки')}
        </Text>
        <Button color="violet" leftSection={<IconPlus size={16} />} variant="light" onClick={() => setFormOpen(true)}>
          {t('Створити платіжну задачу')}
        </Button>
      </Group>

      {visibleProtocols.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Протоколи доставки')}: 0
        </Text>
      ) : (
        <Stack gap="md">
          {visibleProtocols.map((protocol, index) => (
            <ProtocolRow key={protocol.NetUid || index} protocol={protocol} onRemove={() => setRemoveTarget(protocol)} />
          ))}
        </Stack>
      )}

      <AppDrawer opened={isFormOpen} size="md" title={t('Створити платіжну задачу')} onClose={() => setFormOpen(false)}>
        <Stack gap="sm">
          {validationError && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
              {validationError}
            </Alert>
          )}

          <Select
            data={keyOptions}
            label={t('Форма платежу')}
            searchable
            value={protocolKey?.NetUid || null}
            onChange={(netUid) => setProtocolKey(protocolKeys.find((item) => item.NetUid === netUid) || null)}
          />
          <TextInput
            label={t('Вартість Брутто')}
            type="number"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
          <Checkbox
            checked={isAccounting}
            label={t('Бух. витрата')}
            onChange={(event) => setAccounting(event.currentTarget.checked)}
          />

          <TextInput
            label={t('Сплатити до')}
            type="date"
            value={toDateInput(payToDate)}
            onChange={(event) => setPayToDate(fromDateInput(event.currentTarget.value))}
          />
          <Select
            clearable
            data={userOptions}
            label={t('Відповідальний за оплату')}
            searchable
            value={responsible?.NetUid || null}
            onChange={(netUid) => setResponsible(users.find((item) => item.NetUid === netUid) || null)}
          />
          <Textarea
            label={t('Коментар')}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
          />

          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isSaving} variant="light" onClick={() => setFormOpen(false)}>
              {t('Скасувати')}
            </Button>
            <Button color="violet" loading={isSaving} onClick={handleSubmit}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </AppDrawer>

      <AppModal centered opened={Boolean(removeTarget)} title={t('Видалити')} onClose={() => setRemoveTarget(null)}>
        <Stack gap="md">
          <Text size="sm">{t('Ви впевнені, що хочете видалити?')}</Text>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isSaving} variant="light" onClick={() => setRemoveTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" loading={isSaving} onClick={handleRemoveConfirm}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}
