import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconPencil, IconPlus, IconRefresh, IconRestore, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { PermissionGate } from '../../auth/components/PermissionGate'
import {
  getPaymentAccountOrganizations,
  getPaymentAccounts,
} from '../api/paymentAccountsApi'
import { PAYMENT_ACCOUNT_CREATE_PERMISSION, PAYMENT_ACCOUNT_EDIT_PERMISSION } from '../permissions'
import type { Organization, PaymentAccount, PaymentCurrencyRegister } from '../types'
import { PaymentRegisterType } from '../types'

const SEARCH_DEBOUNCE_MS = 350
const SKIPPED_CURRENCY_CODE = ['P', 'L', 'N'].join('')

const PAYMENT_ACCOUNTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['type', 'name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

type TypeFilter = 'all' | '0' | '1' | '2'

export function PaymentAccountsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [accounts, setAccounts] = useValueState<PaymentAccount[]>([])
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [totalEuroAmount, setTotalEuroAmount] = useValueState(0)
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const [typeFilter, setTypeFilter] = useValueState<TypeFilter>('all')
  const [organizationNetId, setOrganizationNetId] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingLookups, setLoadingLookups] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isSearchSettling

  const openAccount = useCallback(
    (account: PaymentAccount) => {
      if (!account.NetUid) {
        return
      }

      navigate(`/accounting/payment-accounts/edit/${account.NetUid}`, {
        state: {
          backgroundLocation: location,
          nodeTitle: account.Name,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

  const columns = usePaymentAccountColumns(openAccount)

  useEffect(() => {
    let isActive = true
    setLoadingLookups(true)

    async function loadLookups() {
      try {
        const nextOrganizations = await getPaymentAccountOrganizations()

        if (isActive) {
          setOrganizations(nextOrganizations)
        }
      } catch (lookupError) {
        if (isActive) {
          setError(lookupError instanceof Error ? lookupError.message : t('Не вдалося завантажити організації'))
        }
      } finally {
        if (isActive) {
          setLoadingLookups(false)
        }
      }
    }

    void loadLookups()

    return () => {
      isActive = false
    }
  }, [setError, setLoadingLookups, setOrganizations, t])

  useEffect(() => {
    let isActive = true
    setLoading(true)
    setError(null)

    async function loadAccounts() {
      try {
        const response = await getPaymentAccounts({
          organizationNetId: organizationNetId || undefined,
          type: typeFilter === 'all' ? '' : (Number(typeFilter) as PaymentRegisterType),
          value: normalizedSearchValue,
        })

        if (isActive) {
          setAccounts(response.paymentRegisters)
          setTotalEuroAmount(response.totalEuroAmount)
        }
      } catch (loadError) {
        if (isActive) {
          setAccounts([])
          setTotalEuroAmount(0)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити рахунки'))
        }
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    void loadAccounts()

    return () => {
      isActive = false
    }
  }, [
    normalizedSearchValue,
    organizationNetId,
    reloadKey,
    setAccounts,
    setError,
    setLoading,
    setTotalEuroAmount,
    t,
    typeFilter,
  ])

  const organizationOptions = useMemo(
    () => toSelectOptions(organizations, (organization) => organization.Name || organization.FullName),
    [organizations],
  )

  function resetFilters() {
    setSearchValue('')
    setTypeFilter('all')
    setOrganizationNetId('')
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder={t('Пошук')}
              value={searchValue}
              style={{ flex: '1 1 auto', minWidth: 180 }}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
            />
            <Tooltip label={t('Скинути фільтри')}>
              <ActionIcon aria-label={t('Скинути фільтри')} color="gray" size={36} variant="light" onClick={resetFilters}>
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} loading={isLoading || isLoadingLookups} variant="light" onClick={reload}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <PermissionGate permissionKey={PAYMENT_ACCOUNT_CREATE_PERMISSION}>
              <Button
                color="violet"
                leftSection={<IconPlus size={16} />}
                onClick={() =>
                  navigate('/accounting/payment-accounts/new', {
                    state: {
                      backgroundLocation: location,
                      returnPath: `${location.pathname}${location.search}`,
                    },
                  })
                }
              >
                {t('Новий рахунок')}
              </Button>
            </PermissionGate>
          </Group>

          <Group align="end" gap="sm" wrap="wrap">
            <SegmentedControl
              data={[
                { label: t('Усі'), value: 'all' },
                { label: t('Готівка'), value: String(PaymentRegisterType.Cash) },
                { label: t('Картка'), value: String(PaymentRegisterType.Card) },
                { label: t('Банк'), value: String(PaymentRegisterType.Bank) },
              ]}
              value={typeFilter}
              onChange={(value) => setTypeFilter((value as TypeFilter | null) || 'all')}
            />
            <Select
              clearable
              searchable
              data={organizationOptions}
              label={t('Організація')}
              placeholder={t('Усі')}
              value={organizationNetId || null}
              w={{ base: '100%', sm: 280 }}
              onChange={(value) => setOrganizationNetId(value || '')}
            />
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Group gap="xs">
            <Badge color="violet" variant="light">
              {t('Завантажено')}: {accounts.length}
            </Badge>
            <Badge color="gray" variant="light">
              {t('Всього в EUR')}: {formatMoney(totalEuroAmount)}
            </Badge>
          </Group>

          <DataTable
            columns={columns}
            data={accounts}
            defaultLayout={PAYMENT_ACCOUNTS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Рахунків не знайдено')}
            getRowId={(account, index) => String(account.NetUid || account.Id || index)}
            isLoading={isTableBusy}
            layoutVersion="payment-accounts-table-1"
            maxHeight="calc(100vh - 330px)"
            minWidth={1120}
            tableId="payment-accounts"
            onRowClick={openAccount}
          />
        </Stack>
      </Card>
    </Stack>
  )
}

function usePaymentAccountColumns(onOpen: (account: PaymentAccount) => void): DataTableColumn<PaymentAccount>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<PaymentAccount>[]>(
    () => [
      {
        id: 'type',
        header: t('Тип'),
        width: 130,
        minWidth: 110,
        accessor: (account) => getPaymentRegisterTypeLabel(account.Type, t),
        cell: (account) => getPaymentRegisterTypeLabel(account.Type, t),
      },
      {
        id: 'name',
        header: t('Назва'),
        minWidth: 240,
        accessor: (account) => account.Name,
        cell: (account) => (
          <Group gap="xs" wrap="nowrap">
            <Text fw={600}>{displayValue(account.Name)}</Text>
            {account.IsForRetail && (
              <Badge color="green" size="xs" variant="light">
                {t('Інтернет-магазин')}
              </Badge>
            )}
          </Group>
        ),
      },
      {
        id: 'currency',
        header: t('Валюта'),
        width: 120,
        minWidth: 104,
        accessor: (account) => getPrimaryCurrencyCode(account),
        cell: (account) => displayValue(getPrimaryCurrencyCode(account)),
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 220,
        minWidth: 180,
        accessor: (account) => account.Organization?.Name || account.Organization?.FullName,
        cell: (account) => displayValue(account.Organization?.Name || account.Organization?.FullName),
      },
      {
        id: 'isActive',
        header: t('Головний'),
        width: 110,
        minWidth: 96,
        align: 'center',
        accessor: (account) => account.IsActive,
        cell: (account) => account.IsActive ? t('Так') : '—',
      },
      {
        id: 'eur',
        header: 'EUR',
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (account) => getCurrencyAmount(account.PaymentCurrencyRegisters, 'EUR'),
        cell: (account) => formatMoney(getCurrencyAmount(account.PaymentCurrencyRegisters, 'EUR')),
      },
      {
        id: 'usd',
        header: 'USD',
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (account) => getCurrencyAmount(account.PaymentCurrencyRegisters, 'USD'),
        cell: (account) => formatMoney(getCurrencyAmount(account.PaymentCurrencyRegisters, 'USD')),
      },
      {
        id: 'uah',
        header: 'UAH',
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (account) => getCurrencyAmount(account.PaymentCurrencyRegisters, 'UAH'),
        cell: (account) => formatMoney(getCurrencyAmount(account.PaymentCurrencyRegisters, 'UAH')),
      },
      {
        id: 'totalEuroAmount',
        header: t('Всього в EUR'),
        width: 160,
        minWidth: 140,
        align: 'right',
        accessor: (account) => account.TotalEuroAmount,
        cell: (account) => formatMoney(account.TotalEuroAmount),
      },
      {
        id: 'actions',
        header: '',
        width: 72,
        minWidth: 64,
        align: 'right',
        enableSorting: false,
        enableHiding: false,
        enablePinning: false,
        enableReorder: false,
        cell: (account) => (
          <PermissionGate permissionKey={PAYMENT_ACCOUNT_EDIT_PERMISSION}>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color="violet"
                disabled={!account.NetUid}
                size="sm"
                variant="subtle"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen(account)
                }}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>
          </PermissionGate>
        ),
      },
    ],
    [onOpen, t],
  )
}

function getPrimaryCurrencyCode(account: PaymentAccount): string | undefined {
  const currencyRegister = account.PaymentCurrencyRegisters?.find(
    (register) => register.Currency?.Code !== SKIPPED_CURRENCY_CODE && (register.Amount || register.IsSelected),
  )

  return currencyRegister?.Currency?.Code || currencyRegister?.Currency?.Name
}

function getCurrencyAmount(registers: PaymentCurrencyRegister[] | undefined, code: string): number {
  return registers?.find((register) => register.Currency?.Code === code)?.Amount || 0
}

function getPaymentRegisterTypeLabel(type: PaymentRegisterType | undefined, t: (value: string) => string): string {
  switch (type) {
    case PaymentRegisterType.Cash:
      return t('Готівка')
    case PaymentRegisterType.Card:
      return t('Картка')
    case PaymentRegisterType.Bank:
      return t('Банк')
    default:
      return '—'
  }
}

function toSelectOptions<T extends { Id?: number; NetUid?: string }>(items: T[], getLabel: (item: T) => string | undefined) {
  return items.reduce<Array<{ label: string; value: string }>>((options, item) => {
    const value = item.NetUid || (typeof item.Id === 'number' ? String(item.Id) : '')

    if (value) {
      options.push({
        label: getLabel(item) || value,
        value,
      })
    }

    return options
  }, [])
}

function formatMoney(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? moneyFormatter.format(value) : '—'
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}
