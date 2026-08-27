import { ActionIcon, Alert, Badge, Select, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, FileDown } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  exportDebtorsDocument,
  getDebtorDebtTotal,
  getDebtorGroupedDebts,
  getDebtorsManagers,
  getDebtorsOrganizations,
  getFilteredDebtors,
} from '../api/salesDebtorsApi'
import { DownloadDocumentModal } from '../components/DownloadDocumentModal'
import { TypeOfClientAgreement, TypeOfCurrencyOfAgreement } from '../types'
import type {
  ClientDebtors,
  DebtorDebtItem,
  DebtorDebtSale,
  DebtorDebtTotal,
  ClientInDebt,
  DebtorsDocumentResult,
  DebtorsManagerOption,
  DebtorsOrganizationOption,
  TypeOfClientAgreement as TypeOfClientAgreementValue,
  TypeOfCurrencyOfAgreement as TypeOfCurrencyOfAgreementValue,
} from '../types'
import '../../../shared/ui/console-table-page.css'
import './sales-debtors-page.css'

const daysOptions = ['3', '5', '7', '10']

const currencyCodeByType: Record<TypeOfCurrencyOfAgreementValue, string> = {
  [TypeOfCurrencyOfAgreement.None]: 'EUR',
  [TypeOfCurrencyOfAgreement.UAH]: 'UAH',
  [TypeOfCurrencyOfAgreement.PLN]: 'PLN',
  [TypeOfCurrencyOfAgreement.EUR]: 'EUR',
  [TypeOfCurrencyOfAgreement.USD]: 'USD',
}

const SALES_DEBTORS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['client'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})
const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const emptyDebtors: ClientDebtors = {
  ClientInDebtors: [],
  TotalMissedDays: 0,
  TotalOverdueDebtorsValue: 0,
  TotalQtyClients: 0,
  TotalRemainderDebtorsValue: 0,
}

export function SalesDebtorsPage() {
  const { t } = useI18n()
  const [userNetId, setUserNetId] = useValueState<string | null>(null)
  const [organizationNetId, setOrganizationNetId] = useValueState<string | null>(null)
  const [typeAgreement, setTypeAgreement] = useValueState<TypeOfClientAgreementValue>(TypeOfClientAgreement.All)
  const [typeCurrency, setTypeCurrency] = useValueState<TypeOfCurrencyOfAgreementValue>(TypeOfCurrencyOfAgreement.None)
  const [days, setDays] = useValueState(3)
  const [page, setPage] = useValueState(1)
  const [pageSize, setPageSize] = useValueState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [managers, setManagers] = useValueState<DebtorsManagerOption[]>([])
  const [organizations, setOrganizations] = useValueState<DebtorsOrganizationOption[]>([])
  const [debtors, setDebtors] = useValueState<ClientDebtors>(emptyDebtors)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isExporting, setExporting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<DebtorsDocumentResult | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const [selectedDebtor, setSelectedDebtor] = useValueState<ClientInDebt | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)

  const offset = (page - 1) * pageSize
  const currencyCode = currencyCodeByType[typeCurrency]
  const debtorColumns = useDebtorColumns(currencyCode, days)
  const totalPages = Math.max(1, Math.ceil(debtors.TotalQtyClients / pageSize))
  const debtorRows = debtors.ClientInDebtors

  const managerOptions = useMemo(
    () =>
      managers.reduce<{ label: string; value: string }[]>((acc, manager) => {
        if (manager.NetUid) {
          acc.push({ label: getManagerLabel(manager), value: String(manager.NetUid) })
        }

        return acc
      }, []),
    [managers],
  )
  const organizationSelectOptions = useMemo(
    () =>
      organizations.reduce<{ label: string; value: string }[]>((acc, organization) => {
        if (organization.NetUid && organization.Name) {
          acc.push({ label: organization.Name, value: String(organization.NetUid) })
        }

        return acc
      }, []),
    [organizations],
  )

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      try {
        const [managerList, organizationList] = await Promise.all([getDebtorsManagers(), getDebtorsOrganizations()])

        if (!cancelled) {
          setManagers(managerList)
          setOrganizations(organizationList)
        }
      } catch {
        if (!cancelled) {
          setManagers([])
          setOrganizations([])
        }
      }
    }

    void loadOptions()

    return () => {
      cancelled = true
    }
  }, [setManagers, setOrganizations])

  useEffect(() => {
    let cancelled = false

    async function loadDebtors() {
      setLoading(true)
      setError(null)

      try {
        const result = await getFilteredDebtors({
          days,
          limit: pageSize,
          offset,
          organizationNetId,
          typeAgreement,
          typeCurrency,
          userNetId,
        })

        if (!cancelled) {
          setDebtors(result)
          setLoading(false)
        }
      } catch (loadError) {
        if (!cancelled) {
          setDebtors(emptyDebtors)
          setLoading(false)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити боржників'))
        }
      }
    }

    void loadDebtors()

    return () => {
      cancelled = true
    }
  }, [days, offset, organizationNetId, pageSize, reloadKey, setDebtors, setError, setLoading, t, typeAgreement, typeCurrency, userNetId])

  async function handleExport() {
    setExporting(true)
    setError(null)

    try {
      const result = await exportDebtorsDocument({
        days,
        organizationNetId,
        typeAgreement,
        typeCurrency,
        userNetId,
      })

      setDownloadDocument(result)
      setDownloadModalOpened(true)
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('Не вдалося сформувати звіт'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Stack className="sales-debtors-page console-table-page" gap={0}>
      <div className="sales-dashboard-tab-content">
        <div className="sales-debtors-command-bar app-filter-bar">
          <Select
            clearable
            searchable
            className="sales-debtors-filter is-manager"
            data={managerOptions}
            label={t('Менеджер')}
            nothingFoundMessage={t('Нічого не знайдено')}
            placeholder={t('Усі')}
            value={userNetId}
            onChange={(value) => {
              setPage(1)
              setUserNetId(value)
            }}
          />
          <Select
            clearable
            searchable
            className="sales-debtors-filter is-organization"
            data={organizationSelectOptions}
            label={t('Організація')}
            placeholder={t('Усі')}
            value={organizationNetId}
            onChange={(value) => {
              setPage(1)
              setOrganizationNetId(value)
            }}
          />
          <Select
            allowDeselect={false}
            className="sales-debtors-filter is-type"
            data={[
              { label: t('Всі'), value: String(TypeOfClientAgreement.All) },
              { label: t('Готівкові'), value: String(TypeOfClientAgreement.VAT) },
              { label: t('Безготівкові'), value: String(TypeOfClientAgreement.WithoutVAT) },
            ]}
            label={t('Тип')}
            value={String(typeAgreement)}
            onChange={(value) => {
              setPage(1)
              setTypeAgreement((Number(value) as TypeOfClientAgreementValue) || TypeOfClientAgreement.All)
            }}
          />
          <Select
            allowDeselect={false}
            className="sales-debtors-filter is-currency"
            data={[
              { label: t('Всі'), value: String(TypeOfCurrencyOfAgreement.None) },
              { label: 'EUR', value: String(TypeOfCurrencyOfAgreement.EUR) },
              { label: 'UAH', value: String(TypeOfCurrencyOfAgreement.UAH) },
              { label: 'PLN', value: String(TypeOfCurrencyOfAgreement.PLN) },
              { label: 'USD', value: String(TypeOfCurrencyOfAgreement.USD) },
            ]}
            label={t('Валюта')}
            value={String(typeCurrency)}
            onChange={(value) => {
              setPage(1)
              setTypeCurrency((Number(value) as TypeOfCurrencyOfAgreementValue) || TypeOfCurrencyOfAgreement.None)
            }}
          />
          <Select
            allowDeselect={false}
            className="sales-debtors-filter is-days"
            data={daysOptions}
            label={t('Борг через днів')}
            value={String(days)}
            onChange={(value) => {
              setPage(1)
              setDays(Number(value) || 3)
            }}
          />
          <div className="app-filter-actions sales-debtors-command-actions">
            <Tooltip label={t('Сформувати звіт')}>
              <ActionIcon
                aria-label={t('Сформувати звіт')}
                color="gray"
                loading={isExporting}
                size={34}
                variant="light"
                onClick={handleExport}
              >
                <FileDown size={17} />
              </ActionIcon>
            </Tooltip>
            <Paginator
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1)
                setPageSize(nextPageSize)
              }}
              onRefresh={reload}
            />
          </div>
          <div className="app-filter-table-toolbar-slot sales-debtors-toolbar-slot" ref={setTableToolbarSlot} />
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="sales-debtors-page__table console-table-body">
          <DataTable
            columns={debtorColumns}
            data={debtorRows}
            defaultLayout={SALES_DEBTORS_TABLE_DEFAULT_LAYOUT}
            fillAvailableWidth
            emptyText={t('Боржників не знайдено')}
            getRowId={(row, index) => String(row.ClientNetId || `${row.ClientName || 'debtor'}-${index}`)}
            height="100%"
            isLoading={isLoading}
            layoutVersion="sales-debtors-table-1"
            minWidth={1120}
            showLayoutControls
            tableId="sales-debtors"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={setSelectedDebtor}
          />
        </div>

        <SalesDebtorsSummary debtors={debtors} currencyCode={currencyCode} />
      </div>

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        onClose={() => setDownloadModalOpened(false)}
      />
      <DebtorDetailDrawer currencyCode={currencyCode} debtor={selectedDebtor} onClose={() => setSelectedDebtor(null)} />
    </Stack>
  )
}

function useDebtorColumns(currencyCode: string, days: number) {
  const { t } = useI18n()

  return useMemo<DataTableColumn<ClientInDebt>[]>(
    () => [
      {
        id: 'region',
        header: t('Регіон'),
        width: 96,
        minWidth: 80,
        accessor: (row) => row.RegionCode || '',
        cell: (row) => <DebtorRegionCell value={row.RegionCode?.trim() || ''} />,
      },
      {
        id: 'client',
        header: t('Клієнт'),
        width: 260,
        minWidth: 220,
        fill: true,
        accessor: (row) => row.ClientName || '',
        cell: (row) => <DebtorClientCell debtor={row} />,
      },
      {
        id: 'manager',
        header: t('Відповідальний'),
        width: 180,
        minWidth: 150,
        accessor: (row) => row.UserName || '',
        cell: (row) => <DebtorManagerCell value={row.UserName?.trim() || ''} />,
      },
      {
        id: 'totalDebtInDays',
        header: `${t('Борг через')} ${days} ${t('днів')}`,
        width: 168,
        minWidth: 140,
        align: 'right',
        accessor: (row) => row.TotalDebtInDays ?? 0,
        cell: (row) => <DebtorAmountCell amount={row.TotalDebtInDays} currencyCode={currencyCode} />,
      },
      {
        id: 'missedDays',
        header: t('Дні'),
        width: 92,
        minWidth: 76,
        align: 'right',
        accessor: (row) => row.MissedDays ?? 0,
        cell: (row) => <DebtorDaysCell value={row.MissedDays ?? 0} />,
      },
      {
        id: 'remainderDebt',
        header: t('Залишок'),
        width: 156,
        minWidth: 130,
        align: 'right',
        accessor: (row) => row.RemainderDebt ?? 0,
        cell: (row) => <DebtorAmountCell amount={row.RemainderDebt} currencyCode={currencyCode} />,
      },
      {
        id: 'overdueDebt',
        header: t('Прострочено'),
        width: 156,
        minWidth: 130,
        align: 'right',
        accessor: (row) => row.OverdueDebt ?? 0,
        cell: (row) => (
          <DebtorAmountCell amount={row.OverdueDebt} currencyCode={currencyCode} tone={(row.OverdueDebt ?? 0) > 0 ? 'danger' : undefined} />
        ),
      },
    ],
    [currencyCode, days, t],
  )
}

function DebtorRegionCell({ value }: { value: string }) {
  if (!value) {
    return null
  }

  return (
    <Badge className="app-role-pill is-gray sales-debtors-region-cell" title={value} variant="light">
      {value}
    </Badge>
  )
}

function DebtorClientCell({ debtor }: { debtor: ClientInDebt }) {
  const title = debtor.ClientName?.trim() || ''
  const subtitle = debtor.CreatedDebt ? formatDateTime(debtor.CreatedDebt) : ''

  return (
    <div className="console-table-entity-cell sales-debtors-client-cell">
      <span className="console-table-entity-copy">
        <span className="console-table-entity-title" title={title}>{title}</span>
        {subtitle ? (
          <span className="console-table-entity-subtitle sales-debtors-client-meta" title={subtitle}>{subtitle}</span>
        ) : null}
      </span>
    </div>
  )
}

function DebtorManagerCell({ value }: { value: string }) {
  return (
    <div className="sales-debtors-manager-cell">
      {value ? (
        <span className="app-role-pill is-yellow sales-debtors-manager-pill" title={value}>
          {value}
        </span>
      ) : null}
    </div>
  )
}

function DebtorAmountCell({
  amount,
  currencyCode,
  tone,
}: {
  amount: number | undefined
  currencyCode: string
  tone?: 'danger'
}) {
  const value = moneyFormatter.format(amount ?? 0)

  return (
    <span className={`sales-debtors-amount-cell${tone === 'danger' ? ' is-danger' : ''}`}>
      <strong>{value}</strong>
      <small>{currencyCode}</small>
    </span>
  )
}

function DebtorDaysCell({ value }: { value: number }) {
  return (
    <span className={`sales-debtors-days-cell${value < 0 ? ' is-danger' : value > 0 ? ' is-warning' : ''}`}>
      <strong className={`app-role-pill sales-debtors-days-pill${value < 0 ? ' is-red' : value > 0 ? ' is-orange' : ' is-gray'}`}>
        {value}
      </strong>
    </span>
  )
}

function SalesDebtorsSummary({ currencyCode, debtors }: { currencyCode: string; debtors: ClientDebtors }) {
  const { t } = useI18n()

  return (
    <div className="sales-debtors-summary">
      <Badge className="app-role-pill is-gray" variant="light">
        {t('Клієнтів')}: {debtors.TotalQtyClients}
      </Badge>
      <Badge className="app-role-pill is-gray" variant="light">
        {t('Днів')}: {debtors.TotalMissedDays}
      </Badge>
      <Badge className="app-role-pill is-gray" variant="light">
        {t('Залишок')}: {moneyFormatter.format(debtors.TotalRemainderDebtorsValue)} {currencyCode}
      </Badge>
      <Badge className="app-role-pill is-gray" variant="light">
        {t('Прострочено')}: {moneyFormatter.format(debtors.TotalOverdueDebtorsValue)} {currencyCode}
      </Badge>
    </div>
  )
}

function DebtorDetailDrawer({
  currencyCode,
  debtor,
  onClose,
}: {
  currencyCode: string
  debtor: ClientInDebt | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [items, setItems] = useValueState<DebtorDebtItem[]>([])
  const [total, setTotal] = useValueState<DebtorDebtTotal | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)

  useEffect(() => {
    const clientNetId = debtor?.ClientNetId

    if (!clientNetId) {
      setItems([])
      setTotal(null)
      setLoading(false)
      setError(null)

      return
    }

    const controller = new AbortController()
    const debtorClientNetId = clientNetId

    async function loadDetails() {
      setLoading(true)
      setError(null)

      try {
        const [nextItems, nextTotal] = await Promise.all([
          getDebtorGroupedDebts(debtorClientNetId, controller.signal),
          getDebtorDebtTotal(debtorClientNetId, controller.signal),
        ])

        setItems(nextItems)
        setTotal(nextTotal)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setItems([])
          setTotal(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити деталі боржника'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadDetails()

    return () => {
      controller.abort()
    }
  }, [debtor?.ClientNetId, setError, setItems, setLoading, setTotal, t])

  return (
    <AppDrawer
      className="sales-debtor-detail-drawer"
      opened={Boolean(debtor)}
      padding="md"
      position="right"
      size="xl"
      title={t('Деталі боржника')}
      onClose={onClose}
    >
      {debtor ? (
        <div className="sales-debtor-detail">
          <section className="sales-debtor-detail-summary">
            <div className="sales-debtor-detail-summary__main">
              <span className="sales-debtor-detail-eyebrow">{t('Клієнт')}</span>
              <Text className="sales-debtor-detail-summary__title">{displayValue(debtor.ClientName)}</Text>
              <Text className="sales-debtor-detail-summary__meta">
                {displayValue(debtor.RegionCode)} · {displayValue(debtor.UserName)}
              </Text>
            </div>
            <div className="sales-debtor-detail-summary__metrics">
              <DebtorDetailMetric label={t('Залишок')} tone="neutral" unit={currencyCode} value={debtor.RemainderDebt} />
              <DebtorDetailMetric label={t('Прострочено')} tone="danger" unit={currencyCode} value={debtor.OverdueDebt} />
              <DebtorDetailMetric format="integer" label={t('Днів')} tone={(debtor.MissedDays ?? 0) < 0 ? 'danger' : 'neutral'} value={debtor.MissedDays} />
            </div>
          </section>

          <div className="sales-debtor-detail-tree">
            <DebtorDetailSection subtitle={currencyCode} title={t('Загальна заборгованість')}>
              <DebtorDetailRow mono label="EUR" value={`${moneyFormatter.format(total?.TotalEuro ?? 0)} EUR`} />
              <DebtorDetailRow mono label="UAH" value={`${moneyFormatter.format(total?.TotalLocal ?? 0)} UAH`} />
              <DebtorDetailRow
                mono
                label={t('По структурі')}
                value={`${moneyFormatter.format(total?.TotalSubClientDebt ?? 0)} UAH`}
              />
            </DebtorDetailSection>

            <DebtorDetailSection subtitle={`${items.length}`} title={t('Борги по клієнту')}>
              {isLoading ? (
                <div className="sales-debtor-detail-state">{t('Завантаження деталей')}</div>
              ) : error ? (
                <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                  {error}
                </Alert>
              ) : items.length === 0 ? (
                <div className="sales-debtor-detail-state">{t('Боргових документів не знайдено')}</div>
              ) : (
                <div className="sales-debtor-detail-related-list">
                  {items.map((item, index) => (
                    <DebtorDebtCard key={item.NetUid || `${item.Id || 'debt'}-${index}`} currencyCode={currencyCode} item={item} />
                  ))}
                </div>
              )}
            </DebtorDetailSection>
          </div>
        </div>
      ) : null}
    </AppDrawer>
  )
}

function DebtorDetailSection({
  children,
  subtitle,
  title,
}: {
  children: ReactNode
  subtitle?: string
  title: string
}) {
  return (
    <section className="sales-debtor-detail-section">
      <div className="sales-debtor-detail-section__head">
        <span className="sales-debtor-detail-section__title">{title}</span>
        {subtitle ? <span className="sales-debtor-detail-section__subtitle">{subtitle}</span> : null}
      </div>
      <div className="sales-debtor-detail-section__body">{children}</div>
    </section>
  )
}

function DebtorDetailRow({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="sales-debtor-detail-row">
      <span className="sales-debtor-detail-row__label">{label}</span>
      <span className="sales-debtor-detail-row__line" aria-hidden />
      <span className={`sales-debtor-detail-row__value${mono ? ' app-money' : ''}`}>{value}</span>
    </div>
  )
}

function DebtorDetailMetric({
  label,
  format = 'money',
  tone,
  unit,
  value,
}: {
  format?: 'integer' | 'money'
  label: string
  tone?: 'danger' | 'neutral'
  unit?: string
  value: number | undefined
}) {
  const formattedValue = format === 'integer' ? String(value ?? 0) : moneyFormatter.format(value ?? 0)

  return (
    <span className={`sales-debtor-detail-metric${tone === 'danger' ? ' is-danger' : ''}`}>
      <span>{label}</span>
      <strong>{formattedValue}</strong>
      {unit ? <small>{unit}</small> : null}
    </span>
  )
}

function DebtorDebtCard({ currencyCode: fallbackCurrencyCode, item }: { currencyCode: string; item: DebtorDebtItem }) {
  const { t } = useI18n()
  const sale = item.Sale || item.ReSale || null
  const documentNumber = getDebtDocumentNumber(item, sale)
  const documentDate = getDebtDocumentDate(item, sale)
  const agreement = getDebtAgreementLabel(item)
  const status = getDebtStatusLabel(sale)
  const currencyCode = item.Agreement?.Currency?.Code || fallbackCurrencyCode
  const amount = item.Debt?.Total ?? sale?.TotalAmount ?? sale?.TotalAmountLocal ?? 0
  const days = item.Debt?.Days ?? 0

  return (
    <article className="sales-debtor-detail-related-card">
      <div className="sales-debtor-detail-related-card__head">
        <Tooltip label={documentNumber}>
          <span>{documentNumber || '-'}</span>
        </Tooltip>
        <span>{documentDate || '-'}</span>
      </div>
      <div className="sales-debtor-detail-related-card__grid">
        <DebtorDetailRow label={t('Договір')} value={agreement || '-'} />
        <DebtorDetailRow label={t('Статус')} value={status || '-'} />
        <DebtorDetailRow
          mono
          label={t('Сума боргу')}
          value={`${moneyFormatter.format(amount)}${currencyCode ? ` ${currencyCode}` : ''}`}
        />
        <DebtorDetailRow label={t('Днів')} value={String(days)} />
      </div>
    </article>
  )
}

function displayValue(value?: string | null): string {
  return value?.trim() || ''
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

function getDebtDocumentNumber(item: DebtorDebtItem, sale: DebtorDebtSale | null): string {
  return displayValue(
    sale?.SaleNumber?.Value ||
    sale?.SaleNumber?.Name ||
    sale?.SaleNumber?.Number ||
    sale?.Number ||
    sale?.Name ||
    item.Debt?.Name,
  )
}

function getDebtDocumentDate(item: DebtorDebtItem, sale: DebtorDebtSale | null): string {
  return formatDateTime(sale?.ChangedToInvoice || sale?.Created || item.Created)
}

function getDebtAgreementLabel(item: DebtorDebtItem): string {
  const agreement = item.Agreement
  const organization = agreement?.Organization?.Name
  const agreementName = agreement?.Name || agreement?.Number

  if (organization && agreementName) {
    return `${organization} · ${agreementName}`
  }

  return displayValue(agreementName || organization)
}

function getDebtStatusLabel(sale: DebtorDebtSale | null): string {
  return displayValue(
    sale?.BaseSalePaymentStatus?.Name ||
    sale?.BaseSalePaymentStatus?.Value ||
    sale?.BaseLifeCycleStatus?.Name ||
    sale?.BaseLifeCycleStatus?.Value,
  )
}

function getManagerLabel(manager: DebtorsManagerOption): string {
  return (
    manager.FullName ||
    manager.Name ||
    [manager.LastName, manager.FirstName, manager.MiddleName].filter(Boolean).join(' ') ||
    manager.Abbreviation ||
    String(manager.NetUid || '')
  )
}
