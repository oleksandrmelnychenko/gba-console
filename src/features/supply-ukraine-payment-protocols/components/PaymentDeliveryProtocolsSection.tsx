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
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import type {
  NewPaymentProtocolFormValues,
  ProtocolUser,
  SupplyOrderUkrainePaymentDeliveryProtocol,
  SupplyOrderUkrainePaymentDeliveryProtocolKey,
} from '../types'
import { formatDate, formatMoney, responsibleName } from './helpers'
import { fromDateInput, toDateInput } from './helpers'

type SelectOption = {
  label: string
  value: string
}

const MONEY_PRECISION = 2
const PERCENT_MAX = 100

function ProtocolRow({
  canRemove,
  onRemove,
  protocol,
}: {
  canRemove: boolean
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
          {canRemove && (
            <Tooltip label={t('Видалити')}>
              <ActionIcon color="red" variant="subtle" onClick={onRemove}>
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          )}
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
            {t('Відсоток')}
          </Text>
          <Text fw={500} size="sm">
            {formatPercent(protocol.Discount)}
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
  canCreateProtocol,
  canRemoveProtocol,
  isSaving,
  onCreateProtocol,
  onRemoveProtocol,
  protocolKeys,
  protocols,
  totalGrossPriceLocal,
  users,
}: {
  canCreateProtocol: boolean
  canRemoveProtocol: boolean
  isSaving: boolean
  onCreateProtocol: (values: NewPaymentProtocolFormValues) => Promise<void>
  onRemoveProtocol: (protocol: SupplyOrderUkrainePaymentDeliveryProtocol) => Promise<void>
  protocolKeys: SupplyOrderUkrainePaymentDeliveryProtocolKey[]
  protocols: SupplyOrderUkrainePaymentDeliveryProtocol[]
  totalGrossPriceLocal: number
  users: ProtocolUser[]
}) {
  const { t } = useI18n()
  const [isFormOpen, setFormOpen] = useValueState(false)
  const [removeTarget, setRemoveTarget] = useValueState<SupplyOrderUkrainePaymentDeliveryProtocol | null>(null)
  const [value, setValue] = useValueState('')
  const [discount, setDiscount] = useValueState('')
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
      const initialValues = getInitialProtocolValues(protocols, totalGrossPriceLocal)

      setValue(initialValues.value)
      setDiscount(initialValues.discount)
      setProtocolKey(protocolKeys[0] || null)
      setResponsible(users[0] || null)
      setPayToDate(new Date())
      setComment('')
      setAccounting(false)
      setValidationError(null)
    }
  }

  const visibleProtocols = protocols.filter((protocol) => !protocol.Deleted)
  const keyOptions = toProtocolKeyOptions(protocolKeys)
  const userOptions = toProtocolUserOptions(users)
  const currentValue = readPositiveNumber(value)
  const currentDiscount = readPositiveNumber(discount)
  const existingValue = sumProtocolValues(visibleProtocols, 'Value')
  const existingDiscount = sumProtocolValues(visibleProtocols, 'Discount')
  const hasKnownTotal = totalGrossPriceLocal > 0

  function updateDiscount(nextValue: string) {
    const numericDiscount = clampNumber(readNumberInput(nextValue) || 0, 0, PERCENT_MAX)
    const nextDiscount = formatInputNumber(numericDiscount)
    const nextAmount = hasKnownTotal ? roundNumber(totalGrossPriceLocal * (numericDiscount / 100)) : currentValue

    setDiscount(nextDiscount)
    setValue(nextAmount ? formatInputNumber(nextAmount) : '')
  }

  function updateValue(nextValue: string) {
    const rawValue = readNumberInput(nextValue) || 0
    const numericValue = hasKnownTotal ? clampNumber(rawValue, 0, totalGrossPriceLocal) : Math.max(rawValue, 0)
    const nextDiscount = hasKnownTotal ? roundNumber((numericValue / totalGrossPriceLocal) * 100) : currentDiscount

    setValue(formatInputNumber(numericValue))
    setDiscount(nextDiscount ? formatInputNumber(nextDiscount) : '')
  }

  async function handleSubmit() {
    if (!protocolKey?.Key) {
      setValidationError(t('Оберіть форму платежу'))

      return
    }

    if (!currentValue) {
      setValidationError(t('Введіть вартість брутто'))

      return
    }

    if (hasKnownTotal && !currentDiscount) {
      setValidationError(t('Введіть відсоток'))

      return
    }

    if (hasKnownTotal && roundNumber(existingValue + currentValue) > roundNumber(totalGrossPriceLocal)) {
      setValidationError(t('Сума платежів не може бути більшою за суму замовлення'))

      return
    }

    if (hasKnownTotal && roundNumber(existingDiscount + currentDiscount) > PERCENT_MAX) {
      setValidationError(t('Сума платежів не може бути більшою за суму замовлення'))

      return
    }

    setValidationError(null)
    try {
      await onCreateProtocol({
        comment,
        discount,
        isAccounting,
        payToDate,
        protocolKey,
        responsible,
        value,
      })
      setFormOpen(false)
    } catch {
      // Parent renders the action error; keep the form open on failure.
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) {
      return
    }

    try {
      await onRemoveProtocol(removeTarget)
      setRemoveTarget(null)
    } catch {
      // Parent renders the action error; keep the confirmation open on failure.
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700} size="lg">
          {t('Протоколи доставки')}
        </Text>
        {canCreateProtocol && (
          <Button color="violet" leftSection={<IconPlus size={16} />} variant="light" onClick={() => setFormOpen(true)}>
            {t('Створити платіжну задачу')}
          </Button>
        )}
      </Group>

      {visibleProtocols.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Протоколи доставки')}: 0
        </Text>
      ) : (
        <Stack gap="md">
          {visibleProtocols.map((protocol, index) => (
            <ProtocolRow
              canRemove={canRemoveProtocol}
              key={protocol.NetUid || index}
              protocol={protocol}
              onRemove={() => setRemoveTarget(protocol)}
            />
          ))}
        </Stack>
      )}

      <AppDrawer
        opened={isFormOpen}
        size="md"
        title={t('Створити платіжну задачу')}
        onClose={() => setFormOpen(false)}
        footer={
          <Button color={CREATE_ACTION_COLOR} loading={isSaving} onClick={handleSubmit}>
            {t('Зберегти')}
          </Button>
        }
      >
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
            onChange={(event) => updateValue(event.currentTarget.value)}
          />
          <TextInput
            label={t('Відсоток')}
            max={PERCENT_MAX}
            min={0}
            type="number"
            value={discount}
            onChange={(event) => updateDiscount(event.currentTarget.value)}
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

function toProtocolKeyOptions(protocolKeys: SupplyOrderUkrainePaymentDeliveryProtocolKey[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const key of protocolKeys) {
    if (!key.NetUid || !key.Key) {
      continue
    }

    options.push({ label: key.Key, value: key.NetUid })
  }

  return options
}

function toProtocolUserOptions(users: ProtocolUser[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const user of users) {
    if (!user.NetUid) {
      continue
    }

    options.push({ label: responsibleName(user) || user.FullName || '', value: user.NetUid })
  }

  return options
}

function getInitialProtocolValues(
  protocols: SupplyOrderUkrainePaymentDeliveryProtocol[],
  totalGrossPriceLocal: number,
): { discount: string; value: string } {
  if (totalGrossPriceLocal <= 0) {
    return {
      discount: '',
      value: '',
    }
  }

  const visibleProtocols = protocols.filter((protocol) => !protocol.Deleted)
  const existingDiscount = sumProtocolValues(visibleProtocols, 'Discount')
  const existingValue = sumProtocolValues(visibleProtocols, 'Value')
  const remainingDiscount = clampNumber(roundNumber(PERCENT_MAX - existingDiscount), 0, PERCENT_MAX)
  const remainingValue = clampNumber(roundNumber(totalGrossPriceLocal - existingValue), 0, totalGrossPriceLocal)

  return {
    discount: formatInputNumber(remainingDiscount),
    value: formatInputNumber(remainingValue),
  }
}

function sumProtocolValues(
  protocols: SupplyOrderUkrainePaymentDeliveryProtocol[],
  key: 'Discount' | 'Value',
): number {
  return roundNumber(protocols.reduce((total, protocol) => total + (readNumberInput(protocol[key]) || 0), 0))
}

function readPositiveNumber(value: string): number {
  return Math.max(0, readNumberInput(value) || 0)
}

function readNumberInput(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().replace(',', '.')

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundNumber(value: number): number {
  const multiplier = 10 ** MONEY_PRECISION

  return Math.round(value * multiplier) / multiplier
}

function formatInputNumber(value: number): string {
  return value ? String(roundNumber(value)) : ''
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-'
  }

  return `${roundNumber(value)} %`
}
