import {
  ActionIcon,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { Check, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { Currency, OrganizationClientAgreement } from '../types'
import {
  createAgreement,
  formatAgreementDate,
  getCurrencyLabel,
  getTodayInputDate,
} from '../utils'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'

const AGREEMENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type AgreementRow = {
  agreement: OrganizationClientAgreement
  index: number
}

type OrganizationClientAgreementsPanelProps = {
  agreements: OrganizationClientAgreement[]
  allowRemovingLast?: boolean
  currencies: Currency[]
  disabled?: boolean
  isLoadingCurrencies?: boolean
  onAddAgreement: (agreement: OrganizationClientAgreement) => void
  onRemoveAgreement: (agreement: OrganizationClientAgreement, index: number) => void
}

export function OrganizationClientAgreementsPanel({
  agreements,
  allowRemovingLast = true,
  currencies,
  disabled = false,
  isLoadingCurrencies = false,
  onAddAgreement,
  onRemoveAgreement,
}: OrganizationClientAgreementsPanelProps) {
  const { t } = useI18n()
  const currencyOptions = useMemo(
    () => currencies.reduce<Array<{ label: string; value: string }>>((options, currency) => {
      if (typeof currency.Id === 'number' && currency.Id > 0) {
        options.push({
          label: getCurrencyLabel(currency),
          value: String(currency.Id),
        })
      }

      return options
    }, []),
    [currencies],
  )
  const [modalOpened, setModalOpened] = useState(false)
  const [currencyId, setCurrencyId] = useState('')
  const [fromDate, setFromDate] = useState(getTodayInputDate)
  const [error, setError] = useState<string | null>(null)
  const canAddAgreement = !disabled && !isLoadingCurrencies && currencyOptions.length > 0
  const agreementRows = useMemo<AgreementRow[]>(
    () => agreements.map((agreement, index) => ({ agreement, index })),
    [agreements],
  )
  const columns = useMemo<DataTableColumn<AgreementRow>[]>(
    () => [
      {
        id: 'number',
        header: 'Номер',
        accessor: (row) => row.agreement.Number,
        width: 140,
      },
      {
        id: 'date',
        header: 'Дата',
        accessor: (row) => row.agreement.FromDate,
        cell: (row) => formatAgreementDate(row.agreement.FromDate),
        width: 130,
      },
      {
        id: 'currency',
        header: 'Валюта',
        accessor: (row) => row.agreement.Currency ? getCurrencyLabel(row.agreement.Currency) : '',
        minWidth: 180,
      },
      {
        id: 'actions',
        header: '',
        align: 'right',
        width: 72,
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (row) => {
          const canRemove = !disabled && (allowRemovingLast || agreements.length > 1)

          return (
            <Tooltip label={canRemove ? t('Видалити') : t('Має залишитися хоча б один договір')}>
              <ActionIcon
                aria-label={t('Видалити договір')}
                color="red"
                disabled={!canRemove}
                size="sm"
                variant="subtle"
                onClick={() => onRemoveAgreement(row.agreement, row.index)}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Tooltip>
          )
        },
      },
    ],
    [agreements.length, allowRemovingLast, disabled, onRemoveAgreement, t],
  )

  function openAddModal() {
    setCurrencyId(currencyOptions[0]?.value || '')
    setFromDate(getTodayInputDate())
    setError(null)
    setModalOpened(true)
  }

  function handleAddAgreement() {
    const selectedCurrency = currencies.find((currency) => String(currency.Id) === currencyId)

    if (!selectedCurrency) {
      setError(t('Оберіть валюту'))
      return
    }

    if (!fromDate) {
      setError(t('Оберіть дату'))
      return
    }

    onAddAgreement(createAgreement(selectedCurrency, fromDate))
    setModalOpened(false)
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text fw={600}>{t('Договори')}</Text>
        <Button
          color={CREATE_ACTION_COLOR}
          disabled={!canAddAgreement}
          leftSection={<Plus size={16} />}
          size="xs"
          variant="light"
          onClick={openAddModal}
        >
          {t('Додати договір')}
        </Button>
      </Group>

      {currencyOptions.length === 0 && !isLoadingCurrencies && (
        <Text c="dimmed" size="sm">
          {t('Валюти недоступні')}
        </Text>
      )}

      <DataTable
        columns={columns}
        data={agreementRows}
        defaultLayout={AGREEMENTS_TABLE_DEFAULT_LAYOUT}
        emptyText={t('Договорів не додано')}
        getRowId={(row) => String(row.agreement.NetUid || row.agreement.Id || row.index)}
        layoutVersion="organization-client-agreements-table-1"
        minWidth={560}
        tableId="organization-client-agreements"
      />

      <AppModal centered opened={modalOpened} title={t('Новий договір')} onClose={() => setModalOpened(false)}>
        <Stack gap="md">
          <Select
            data={currencyOptions}
            label={t('Валюта')}
            required
            value={currencyId}
            onChange={(value) => {
              setCurrencyId(value || '')
              setError(null)
            }}
          />
          <TextInput
            label={t('Дата')}
            required
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.currentTarget.value)
              setError(null)
            }}
          />
          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setModalOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} leftSection={<Check size={16} />} onClick={handleAddAgreement}>
              {t('Додати')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
}
