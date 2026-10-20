import {
  Alert,
  Button,
  Group,
  NumberFormatter,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { CircleAlert, Plus, Save } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { TableChip } from '../../../shared/ui/TableChip'
import { ToolbarDateRangeFilter } from '../../../shared/ui/ToolbarDateRangeFilter'
import './currency-trader-exchange-rates.css'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { TableShimmerRows } from '../../../shared/ui/table-shimmer/TableShimmerRows'
import { CURRENCY_ORDER } from '../types'
import type { CurrencyTrader, CurrencyTraderExchangeRate } from '../types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

type NewRateDraft = {
  date: string
  rates: Record<string, string>
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })

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
  onChangeDateRange: (range: { from: string; to: string }) => void
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
  onChangeDateRange,
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
    <AppModal className="currency-trader-rates-modal app-compact-form" opened={Boolean(trader)} size={700} title={title} onClose={onClose}>
      <Stack className="currency-trader-rates-content" gap={12}>
        <div className="app-filter-bar currency-trader-rates-toolbar">
          <ToolbarDateRangeFilter from={from} to={to} onChange={onChangeDateRange} />
          <Text className="currency-trader-rates-heading">{t('Курси валют')}</Text>
          {canEdit && showAddButton && !isAdding && (
            <Button color={CREATE_ACTION_COLOR} leftSection={<Plus size={16} />} onClick={onStartAdd}>
              {t('Додати курс')}
            </Button>
          )}
        </div>

        {error && (
          <Alert className="currency-trader-rates-error" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        {isAdding && (
          <div className="currency-trader-rates-create">
            <div className="currency-trader-rates-fields">
              <TextInput maw={170}
                className="currency-trader-rates-date-field"
                label={t('Дата курсу валют')}
                type="date"
                value={newRateDraft.date}
                onChange={(event) => onChangeNewRateDate(event.currentTarget.value)}
              />
              {CURRENCY_ORDER.map((currency) => (
                <TextInput maw={160}
                  key={currency}
                  inputMode="decimal"
                  label={<TableChip tone="source" value={currency} />}
                  value={newRateDraft.rates[currency] || ''}
                  onChange={(event) => onChangeNewRateValue(currency, event.currentTarget.value)}
                />
              ))}
            </div>
            <AppModalFooter>
              <Button color="gray" disabled={isSaving} variant="default" onClick={onCancelAdd}>
                {t('Скасувати')}
              </Button>
              <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} onClick={onSaveNewRate}>
                {t('Зберегти')}
              </Button>
            </AppModalFooter>
          </div>
        )}

        {!isLoading && rates.length === 0 ? (
          <div className="currency-trader-rates-empty"><Text>{t('Курсів валют не знайдено')}</Text></div>
        ) : (
          <div className="currency-trader-rates-table-scroll">
            <Table className="app-static-table currency-trader-rates-table" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('Дата курсу валют')}</Table.Th>
                  <Table.Th>{t('Валюта')}</Table.Th>
                  <Table.Th className="currency-trader-rates-number">{t('Курс валют')}</Table.Th>
                  {canEdit && <Table.Th className="currency-trader-rates-actions-heading" aria-label={t('Дії')} />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody aria-busy={isLoading}>
                {isLoading ? (
                  <TableShimmerRows columns={canEdit ? 4 : 3} />
                ) : rates.map((rate, index) => {
                  const isEditing = editingRate === rate

                  return (
                    <Table.Tr key={rate.NetUid || rate.Id || index}>
                      <Table.Td className="currency-trader-rates-mono">{formatDate(rate.FromDate)}</Table.Td>
                      <Table.Td>
                        <TableChip tone="source" value={rate.CurrencyName || '-'} />
                      </Table.Td>
                      <Table.Td className="app-table-number currency-trader-rates-number currency-trader-rates-mono">
                        {isEditing ? (
                          <TextInput maw={160}
                            inputMode="decimal"
                            aria-label={t('Курс валют')}
                            size="xs"
                            value={editingValue}
                            onChange={(event) => onChangeEditingValue(event.currentTarget.value)}
                          />
                        ) : (
                          <NumberFormatter decimalScale={2} fixedDecimalScale value={rate.ExchangeRate ?? 0} />
                        )}
                      </Table.Td>
                      {canEdit && (
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            {isEditing ? (
                              <>
                                <TableRowAction
                                  action="save"
                                  loading={isSaving}
                                  label={t('Зберегти')}
                                  onClick={onSaveEdit}
                                />
                                <TableRowAction
                                  action="cancel"
                                  disabled={isSaving}
                                  label={t('Скасувати')}
                                  onClick={onCancelEdit}
                                />
                              </>
                            ) : (
                              <>
                                <TableRowAction
                                  action="edit"
                                  disabled={isSaving}
                                  label={t('Редагувати')}
                                  onClick={() => onStartEdit(rate)}
                                />
                                <TableRowAction
                                  action="delete"
                                  disabled={isSaving}
                                  label={t('Видалити')}
                                  onClick={() => onDelete(rate)}
                                />
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
          </div>
        )}
      </Stack>
    </AppModal>
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
