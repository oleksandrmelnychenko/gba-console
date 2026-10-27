import { formatEuroValuation } from '../euroValuation'
import { getOrganizationDisplayName } from '../../../shared/organizations/organizationDisplayName'
import { TableChip } from '../../../shared/ui/TableChip'
import {
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
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, CreditCard, Landmark, List, Wallet, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useMutatedListRefresh } from '../../../shared/router/useMutatedListRefresh'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { usePermissions } from '../../auth/usePermissions'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import {
  getPaymentAccountOrganizations,
  getPaymentAccounts,
} from '../api/paymentAccountsApi'
import { PAYMENT_ACCOUNT_CREATE_PERMISSION, PAYMENT_ACCOUNT_EDIT_PERMISSION } from '../permissions'
import type { Organization, PaymentAccount, PaymentCurrencyRegister } from '../types'
import { PaymentRegisterType } from '../types'
import { PAYMENT_BALANCE_SOURCE_NOTE } from '../balanceSource'
import './payment-accounts-page.css'

const SEARCH_DEBOUNCE_MS = 350
const SKIPPED_CURRENCY_CODE = ['P', 'L', 'N'].join('')

const PAYMENT_ACCOUNTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['type', 'name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type TypeFilter = 'all' | '0' | '1' | '2'

export function PaymentAccountsPage() {
  const { t } = useI18n()
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return <Text c="dimmed">{t('Завантаження')}</Text>
  }

  if (!can(PermissionKeys.FinancialAdministration.PaymentAccounts.Page.View)) {
    return (
      <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
        {t('Недостатньо прав для перегляду платіжних рахунків')}
      </Alert>
    )
  }

  return <PaymentAccountsPageContent />
}

function PaymentAccountsPageContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [accounts, setAccounts] = useValueState<PaymentAccount[]>([])
  const [totalEuroAmount, setTotalEuroAmount] = useValueState<number | null>(null)
  const [organizations, setOrganizations] = useValueState<Organization[]>([])
  const [searchValue, setSearchValue] = useValueState(() => searchParams.get('value') || '')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const [typeFilter, setTypeFilter] = useValueState<TypeFilter>(() => normalizeTypeFilter(searchParams.get('type')))
  const [organizationNetId, setOrganizationNetId] = useValueState(() => searchParams.get('organizationNetId') || '')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isLoadingLookups, setLoadingLookups] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useMutatedListRefresh(reload)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
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
          nodeTitle: account.Name,
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

  const columns = usePaymentAccountColumns(openAccount)

  useEffect(() => {
    const nextSearchParams = new URLSearchParams()
    const nextSearchValue = searchValue.trim()

    if (nextSearchValue) {
      nextSearchParams.set('value', nextSearchValue)
    }

    if (typeFilter !== 'all') {
      nextSearchParams.set('type', typeFilter)
    }

    if (organizationNetId) {
      nextSearchParams.set('organizationNetId', organizationNetId)
    }

    setSearchParams(nextSearchParams, { replace: true })
  }, [organizationNetId, searchValue, setSearchParams, typeFilter])

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
          setTotalEuroAmount(null)
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
    <Stack className="payment-accounts-page" gap={6}>
      <Card className="app-data-card payment-accounts-card" withBorder radius="md" padding={0}>
        <div className="app-filter-bar payment-accounts-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="app-filter-fields payment-accounts-filter-row">
            <TextInput
              size="sm"
              leftSection={<Search size={16} />}
              label={t('Пошук')}
              placeholder={t('Введіть значення')}
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
              className="payment-accounts-search"
            />
            <div className="app-filter-field payment-accounts-type-filter">
              <span className="app-filter-label">{t('Тип')}</span>
              <SegmentedControl
                data={[
                  { label: <span className="payment-accounts-type-label"><List size={15} aria-hidden="true" />{t('Усі')}</span>, value: 'all' },
                  { label: <span className="payment-accounts-type-label"><Wallet size={15} aria-hidden="true" />{t('Каса')}</span>, value: String(PaymentRegisterType.Cash) },
                  { label: <span className="payment-accounts-type-label"><CreditCard size={15} aria-hidden="true" />{t('Банківська картка')}</span>, value: String(PaymentRegisterType.Card) },
                  { label: <span className="payment-accounts-type-label"><Landmark size={15} aria-hidden="true" />{t('Банк')}</span>, value: String(PaymentRegisterType.Bank) },
                ]}
                value={typeFilter}
                onChange={(value) => setTypeFilter((value as TypeFilter | null) || 'all')}
              />
            </div>
            <Select
              classNames={{ dropdown: 'payment-accounts-toolbar-dropdown' }}
              comboboxProps={{ width: 'max-content', position: 'bottom-start' }}
              clearable
              searchable
              data={organizationOptions}
              label={t('Організація')}
              placeholder={t('Усі')}
              value={organizationNetId || null}
              className="payment-accounts-organization"
              onChange={(value) => setOrganizationNetId(value || '')}
            />
            <div className="app-filter-actions">
              <Button aria-label={t('Скинути')} title={t('Скинути')} variant="default" size="sm" leftSection={<RotateCcw size={16} />} onClick={resetFilters}>
                {t('Скинути')}
              </Button>
              <Button aria-label={t('Оновити')} title={t('Оновити')} variant="default" size="sm" leftSection={<RefreshCw size={16} />}
                loading={isLoading || isLoadingLookups} onClick={reload}>
                {t('Оновити')}
              </Button>
            </div>
            <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
            <PermissionGate permissionKey={PAYMENT_ACCOUNT_CREATE_PERMISSION}>
              <Button
                color={CREATE_ACTION_COLOR}
                leftSection={<Plus size={16} />}
                size="sm"
                styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
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
        </div>

        <Stack className="payment-accounts-card__body" gap={0}>
          {error && (
            <Alert className="payment-accounts-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <div className="payment-accounts-page__table">
            <DataTable
              columns={columns}
              data={accounts}
              defaultLayout={PAYMENT_ACCOUNTS_TABLE_DEFAULT_LAYOUT}
              emptyText={t('Рахунків не знайдено')}
              getRowId={(account, index) => String(account.NetUid || account.Id || index)}
              height="100%"
              isLoading={isTableBusy}
              layoutVersion="payment-accounts-table-1"
              minWidth={1120}
              showLayoutControls
              tableId="payment-accounts"
              toolbarPortalTarget={tableToolbarSlot}
              onRowClick={openAccount}
            />
          </div>

          <Text size="xs" c="dimmed">{t(PAYMENT_BALANCE_SOURCE_NOTE)}</Text>
          {totalEuroAmount === null && !isLoading && !error && <Text size="sm" c="orange">{t('Оцінка EUR недоступна: перевірте валюту та курс. Залишки у валюті рахунків збережені.')}</Text>}
          <Group className="payment-accounts-total-footer" gap="xs" justify="flex-end" wrap="nowrap">
            <Badge className="app-role-pill is-gray" variant="light">
              {t('Поточний еквівалент')} <span className="app-money">EUR</span>: <span className="app-money">{t(formatEuroValuation(totalEuroAmount))}</span>
            </Badge>
          </Group>
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
        cell: (account) => <TableChip value={getPaymentRegisterTypeLabel(account.Type, t)} />,
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
              <Badge className="app-role-pill is-green" size="xs" variant="light">
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
        cell: (account) => <TableChip tone="source" value={displayValue(getPrimaryCurrencyCode(account))} />,
      },
      {
        id: 'organization',
        header: t('Організація'),
        width: 220,
        minWidth: 180,
        accessor: (account) => account.Organization?.Name || account.Organization?.FullName,
        cell: (account) => <TableChip tone="product" value={displayValue(getOrganizationDisplayName(account.Organization))} />,
      },
      {
        id: 'isActive',
        header: t('Основний'),
        width: 110,
        minWidth: 96,
        align: 'center',
        accessor: (account) => account.IsActive,
        cell: (account) =>
          account.IsActive ? (
            <Badge className="app-role-pill is-orange" size="xs" variant="light">
              {t('Основний')}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              -
            </Text>
          ),
      },
      {
        id: 'eur',
        header: 'EUR',
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (account) => getCurrencyAmount(account.PaymentCurrencyRegisters, 'EUR'),
        cell: (account) => formatCurrencyCell(account.PaymentCurrencyRegisters, 'EUR'),
      },
      {
        id: 'usd',
        header: 'USD',
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (account) => getCurrencyAmount(account.PaymentCurrencyRegisters, 'USD'),
        cell: (account) => formatCurrencyCell(account.PaymentCurrencyRegisters, 'USD'),
      },
      {
        id: 'uah',
        header: 'UAH',
        width: 130,
        minWidth: 112,
        align: 'right',
        accessor: (account) => getCurrencyAmount(account.PaymentCurrencyRegisters, 'UAH'),
        cell: (account) => formatCurrencyCell(account.PaymentCurrencyRegisters, 'UAH'),
      },
      {
        id: 'totalEuroAmount',
        header: t('Всього в EUR'),
        width: 160,
        minWidth: 140,
        align: 'right',
        accessor: (account) => account.TotalEuroAmount,
        cell: (account) => t(formatEuroValuation(account.TotalEuroAmount)),
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
            <TableRowAction
              action="edit"
              disabled={!account.NetUid}
              label={t('Редагувати')}
              onClick={() => onOpen(account)}
            />
          </PermissionGate>
        ),
      },
    ],
    [onOpen, t],
  )
}

function getPrimaryCurrencyCode(account: PaymentAccount): string | undefined {
  const currencyRegister = account.PaymentCurrencyRegisters?.find(
    (register) =>
      register.Currency?.Code !== SKIPPED_CURRENCY_CODE &&
      (register.IsSelected || register.NetUid || register.Id || Boolean(register.Amount)),
  )

  return currencyRegister?.Currency?.Code || currencyRegister?.Currency?.Name
}

function getCurrencyAmount(registers: PaymentCurrencyRegister[] | undefined, code: string): number {
  return registers?.find((register) => register.Currency?.Code === code)?.Amount || 0
}

function formatCurrencyCell(registers: PaymentCurrencyRegister[] | undefined, code: string): string {
  const register = registers?.find((item) => item.Currency?.Code === code)

  return register ? formatMoney(register.Amount || 0) : ''
}

function getPaymentRegisterTypeLabel(type: PaymentRegisterType | undefined, t: (value: string) => string): string {
  switch (type) {
    case PaymentRegisterType.Cash:
      return t('Каса')
    case PaymentRegisterType.Card:
      return t('Банківська картка')
    case PaymentRegisterType.Bank:
      return t('Банк')
    default:
      return ''
  }
}

function normalizeTypeFilter(value: string | null): TypeFilter {
  return value === '0' || value === '1' || value === '2' ? value : 'all'
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

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

function formatMoney(value?: number): string {
  const numberToFormat = typeof value === 'number' && Number.isFinite(value) ? value : 0

  return moneyFormatter.format(numberToFormat)
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}
