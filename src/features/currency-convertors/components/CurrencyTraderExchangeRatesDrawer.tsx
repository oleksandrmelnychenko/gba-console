import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberFormatter,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { IconAlertCircle, IconDeviceFloppy, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CURRENCY_ORDER } from '../types'
import type { CurrencyTrader, CurrencyTraderExchangeRate } from '../types'

type NewRateDraft = {
  date: string
  rates: Record<string, string>
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short' })

type CurrencyTraderExchangeRatesViewState = {
  canEdit: boolean
  isAdding: boolean
  isLoading: boolean
  isSaving: boolean
  showAddButton: boolean
}

type CurrencyTraderExchangeRatesDrawerProps = {
  trader: CurrencyTrader | null
  rates: CurrencyTraderExchangeRate[]
  from: string
  to: string
  error: string | null
  viewState: CurrencyTraderExchangeRatesViewState
  newRateDraft: NewRateDraft
  editingRate: CurrencyTraderExchangeRate | null
  editingValue: string
  onClose: () => void
  onChangeFrom: (value: string) => void
  onChangeTo: (value: string) => void
  onStartAdd: () => void
  onCancelAdd: () => void
  onChangeNewRateDate: (value: string) => void
  onChangeNewRateValue: (currency: string, value: string) => void
  onSaveNewRate: () => void
  onStartEdit: (rate: CurrencyTraderExchangeRate) => void
  onCancelEdit: () => void
  onChangeEditingValue: (value: string) => void
  onSaveEdit: () => void
  onDelete: (rate: CurrencyTraderExchangeRate) => void
}

export function CurrencyTraderExchangeRatesDrawer({
  trader,
  rates,
  from,
  to,
  error,
  viewState,
  newRateDraft,
  editingRate,
  editingValue,
  onClose,
  onChangeFrom,
  onChangeTo,
  onStartAdd,
  onCancelAdd,
  onChangeNewRateDate,
  onChangeNewRateValue,
  onSaveNewRate,
  onStartEdit,
  onCancelEdit,
  onChangeEditingValue,
  onSaveEdit,
  onDelete,
}: CurrencyTraderExchangeRatesDrawerProps) {
  const { t } = useI18n()
  const title = trader ? getTraderTitle(trader) : t('Курс валют')
  const { canEdit, isAdding, isLoading, isSaving, showAddButton } = viewState

  return (
    <AppDrawer opened={Boolean(trader)} size="lg" title={title} onClose={onClose}>
      <Stack gap="md">
        <Group align="end" gap="sm" wrap="nowrap">
          <TextInput
            label={t('Від якої дати')}
            max={to || undefined}
            type="date"
            value={from}
            onChange={(event) => onChangeFrom(event.currentTarget.value)}
          />
          <TextInput
            label={t('До якої дати')}
            min={from || undefined}
            type="date"
            value={to}
            onChange={(event) => onChangeTo(event.currentTarget.value)}
          />
          {canEdit && showAddButton && !isAdding && (
            <Button color="violet" leftSection={<IconPlus size={16} />} onClick={onStartAdd}>
              {t('Добавити курс валют')}
            </Button>
          )}
        </Group>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {isAdding && (
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <TextInput
                label={t('Дата курсу валют')}
                type="date"
                value={newRateDraft.date}
                onChange={(event) => onChangeNewRateDate(event.currentTarget.value)}
              />
              {CURRENCY_ORDER.map((currency) => (
                <TextInput
                  key={currency}
                  inputMode="decimal"
                  label={currency}
                  value={newRateDraft.rates[currency] || ''}
                  onChange={(event) => onChangeNewRateValue(currency, event.currentTarget.value)}
                />
              ))}
              <Group justify="flex-end" gap="xs">
                <Button color="gray" disabled={isSaving} variant="light" onClick={onCancelAdd}>
                  {t('Скасувати')}
                </Button>
                <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} onClick={onSaveNewRate}>
                  {t('Зберегти')}
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {isLoading ? (
          <Text c="dimmed">{t('Завантаження курсів валют')}</Text>
        ) : rates.length === 0 ? (
          <Text c="dimmed">{t('Курсів валют не знайдено')}</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Дата курсу валют')}</Table.Th>
                <Table.Th>{t('Валюта')}</Table.Th>
                <Table.Th>{t('Курс валют')}</Table.Th>
                {canEdit && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rates.map((rate, index) => {
                const isEditing = editingRate === rate

                return (
                  <Table.Tr key={rate.NetUid || rate.Id || index}>
                    <Table.Td>{formatDate(rate.FromDate)}</Table.Td>
                    <Table.Td>
                      <Badge color="gray" variant="light">
                        {rate.CurrencyName || '-'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {isEditing ? (
                        <TextInput
                          inputMode="decimal"
                          size="xs"
                          value={editingValue}
                          onChange={(event) => onChangeEditingValue(event.currentTarget.value)}
                        />
                      ) : (
                        <NumberFormatter decimalScale={4} value={rate.ExchangeRate ?? 0} />
                      )}
                    </Table.Td>
                    {canEdit && (
                      <Table.Td>
                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                          {isEditing ? (
                            <>
                              <ActionIcon
                                aria-label={t('Зберегти')}
                                color="violet"
                                loading={isSaving}
                                variant="light"
                                onClick={onSaveEdit}
                              >
                                <IconDeviceFloppy size={16} />
                              </ActionIcon>
                              <ActionIcon
                                aria-label={t('Скасувати')}
                                color="gray"
                                disabled={isSaving}
                                variant="light"
                                onClick={onCancelEdit}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </>
                          ) : (
                            <>
                              <ActionIcon
                                aria-label={t('Редагувати')}
                                color="gray"
                                disabled={isSaving}
                                variant="subtle"
                                onClick={() => onStartEdit(rate)}
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                              <ActionIcon
                                aria-label={t('Видалити')}
                                color="red"
                                disabled={isSaving}
                                variant="subtle"
                                onClick={() => onDelete(rate)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </>
                          )}
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </AppDrawer>
  )
}

function getTraderTitle(trader: CurrencyTrader): string {
  return [trader.FirstName, trader.LastName, trader.MiddleName].filter(Boolean).join(' ').trim() || (trader.FirstName ?? '')
}

function formatDate(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateFormatter.format(date)
}
