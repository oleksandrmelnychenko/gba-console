import { ActionIcon, Alert, Button, Card, Group, Select, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconChevronLeft, IconChevronRight, IconFileDownload } from '@tabler/icons-react'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import { DataTableDensityToggle } from '../../../shared/ui/data-table/DataTableDensityToggle'
import { useDataTableDensity } from '../../../shared/ui/data-table/useDataTableDensity'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  exportDebtorsDocument,
  getDebtorsManagers,
  getDebtorsOrganizations,
  getFilteredDebtors,
} from '../api/salesDebtorsApi'
import { DownloadDocumentModal } from '../components/DownloadDocumentModal'
import { TypeOfClientAgreement, TypeOfCurrencyOfAgreement } from '../types'
import type {
  ClientDebtors,
  ClientInDebt,
  DebtorsDocumentResult,
  DebtorsManagerOption,
  DebtorsOrganizationOption,
  TypeOfClientAgreement as TypeOfClientAgreementValue,
  TypeOfCurrencyOfAgreement as TypeOfCurrencyOfAgreementValue,
} from '../types'

const PAGE_SIZE = 20
const pageSizeOptions = ['20', '40', '60', '100']
const daysOptions = ['3', '5', '7', '10']

const currencyCodeByType: Record<TypeOfCurrencyOfAgreementValue, string> = {
  [TypeOfCurrencyOfAgreement.None]: 'EUR',
  [TypeOfCurrencyOfAgreement.UAH]: 'UAH',
  [TypeOfCurrencyOfAgreement.PLN]: 'PLN',
  [TypeOfCurrencyOfAgreement.EUR]: 'EUR',
  [TypeOfCurrencyOfAgreement.USD]: 'USD',
}

const DEBTORS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['regionCode', 'clientName'],
  },
  density: 'compact',
} satisfies DataTableDefaultLayout

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
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
  const [pageSize, setPageSize] = useValueState(PAGE_SIZE)
  const [managers, setManagers] = useValueState<DebtorsManagerOption[]>([])
  const [organizations, setOrganizations] = useValueState<DebtorsOrganizationOption[]>([])
  const [debtors, setDebtors] = useValueState<ClientDebtors>(emptyDebtors)
  const [isLoading, setLoading] = useValueState(false)
  const [error, setError] = useValueState<string | null>(null)
  const [isExporting, setExporting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<DebtorsDocumentResult | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)

  const offset = (page - 1) * pageSize
  const currencyCode = currencyCodeByType[typeCurrency]
  const totalPages = Math.max(1, Math.ceil(debtors.TotalQtyClients / pageSize))
  const columns = useDebtorsColumns(days, t)
  const { density, toggleDensity } = useDataTableDensity('sales-debtors', DEBTORS_TABLE_DEFAULT_LAYOUT.density)

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
          acc.push({ label: organization.Name || '', value: String(organization.NetUid) })
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
  }, [days, offset, organizationNetId, pageSize, setDebtors, setError, setLoading, t, typeAgreement, typeCurrency, userNetId])

  async function handleExport() {
    setExporting(true)
    setError(null)

    try {
      const result = await exportDebtorsDocument({
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
    <Stack gap="lg">
      <Card withBorder radius="md" padding={0} className="app-filter-card">
        <Group align="end" gap="sm" wrap="wrap" className="app-filter-bar">
            <Select
              clearable
              searchable
              data={managerOptions}
              label={t('Менеджер')}
              nothingFoundMessage={t('Нічого не знайдено')}
              placeholder={t('Усі')}
              value={userNetId}
              w={260}
              onChange={(value) => {
                setPage(1)
                setUserNetId(value)
              }}
            />
            <Select
              clearable
              searchable
              data={organizationSelectOptions}
              label={t('Організація')}
              placeholder={t('Усі')}
              value={organizationNetId}
              w={240}
              onChange={(value) => {
                setPage(1)
                setOrganizationNetId(value)
              }}
            />
            <Select
              allowDeselect={false}
              data={[
                { label: t('Всі'), value: String(TypeOfClientAgreement.All) },
                { label: t('Готівкові'), value: String(TypeOfClientAgreement.VAT) },
                { label: t('Безготівкові'), value: String(TypeOfClientAgreement.WithoutVAT) },
              ]}
              label={t('Тип')}
              value={String(typeAgreement)}
              w={160}
              onChange={(value) => {
                setPage(1)
                setTypeAgreement((Number(value) as TypeOfClientAgreementValue) || TypeOfClientAgreement.All)
              }}
            />
            <Select
              allowDeselect={false}
              data={[
                { label: t('Всі'), value: String(TypeOfCurrencyOfAgreement.None) },
                { label: 'EUR', value: String(TypeOfCurrencyOfAgreement.EUR) },
                { label: 'UAH', value: String(TypeOfCurrencyOfAgreement.UAH) },
                { label: 'PLN', value: String(TypeOfCurrencyOfAgreement.PLN) },
                { label: 'USD', value: String(TypeOfCurrencyOfAgreement.USD) },
              ]}
              label={t('Валюта')}
              value={String(typeCurrency)}
              w={140}
              onChange={(value) => {
                setPage(1)
                setTypeCurrency((Number(value) as TypeOfCurrencyOfAgreementValue) || TypeOfCurrencyOfAgreement.None)
              }}
            />
            <Select
              allowDeselect={false}
              data={daysOptions}
              label={t('Борг через днів')}
              value={String(days)}
              w={140}
              onChange={(value) => {
                setPage(1)
                setDays(Number(value) || 3)
              }}
            />
            <Button
              leftSection={<IconFileDownload size={16} />}
              loading={isExporting}
              ml="auto"
              onClick={handleExport}
            >
              {t('Сформувати звіт')}
            </Button>
            <Group gap={4} wrap="nowrap">
              <Select
                aria-label={t('Розмір сторінки')}
                data={pageSizeOptions}
                disabled={isLoading}
                size="xs"
                value={String(pageSize)}
                w={72}
                onChange={(value) => {
                  setPage(1)
                  setPageSize(Number(value) || PAGE_SIZE)
                }}
              />
              <Text size="xs" c="dark" fw={700} style={{ whiteSpace: 'nowrap' }}>
                {t('стор.')} {page}
              </Text>
              <ActionIcon
                aria-label={t('Попередня сторінка')}
                color="gray"
                disabled={page <= 1 || isLoading}
                size="sm"
                variant="subtle"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon
                aria-label={t('Наступна сторінка')}
                color="gray"
                disabled={page >= totalPages || isLoading}
                size="sm"
                variant="subtle"
                onClick={() => setPage((current) => current + 1)}
              >
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>
            <DataTableDensityToggle density={density} onToggle={toggleDensity} size="sm" />
          </Group>

          <Stack gap="md" p="md">
            {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={debtors.ClientInDebtors}
            defaultLayout={DEBTORS_TABLE_DEFAULT_LAYOUT}
            density={density}
            emptyText={t('Боржників не знайдено')}
            getRowId={(debtor, index) => String(debtor.ClientNetId || index)}
            isLoading={isLoading}
            layoutVersion="sales-debtors-table-2-compact"
            loadingText={t('Завантаження боржників')}
            maxHeight="calc(100vh - 360px)"
            minWidth={1100}
            tableId="sales-debtors"
          />

          <Group justify="flex-end" gap="xl" px="xs" wrap="wrap">
            <Text size="sm" c="dimmed">
              {t('Загальна кількість днів')}:{' '}
              <Text span fw={700} c={debtors.TotalMissedDays < 0 ? 'red' : 'dark'}>
                {debtors.TotalMissedDays}
              </Text>
            </Text>
            <Text size="sm" c="dimmed">
              {t('Залишок боргу')}:{' '}
              <Text span fw={700} c="dark">
                {moneyFormatter.format(debtors.TotalRemainderDebtorsValue)} {currencyCode}
              </Text>
            </Text>
            <Text size="sm" c="dimmed">
              {t('Прострочений борг')}:{' '}
              <Text span fw={700} c={debtors.TotalOverdueDebtorsValue > 0 ? 'red' : 'dark'}>
                {moneyFormatter.format(debtors.TotalOverdueDebtorsValue)} {currencyCode}
              </Text>
            </Text>
          </Group>
        </Stack>
      </Card>

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        onClose={() => setDownloadModalOpened(false)}
      />
    </Stack>
  )
}

function useDebtorsColumns(days: number, t: (key: string) => string): DataTableColumn<ClientInDebt>[] {
  return useMemo<DataTableColumn<ClientInDebt>[]>(
    () => [
      {
        id: 'regionCode',
        header: t('Код регіону'),
        accessor: (debtor) => debtor.RegionCode || '',
        width: 120,
      },
      {
        id: 'clientName',
        header: t('Клієнт'),
        accessor: (debtor) => debtor.ClientName || '',
        minWidth: 240,
      },
      {
        id: 'userName',
        header: t('Відповідальний'),
        accessor: (debtor) => debtor.UserName || '',
        width: 280,
      },
      {
        id: 'totalDebtInDays',
        header: `${t('Борг через')} ${days} ${t('днів')}`,
        accessor: (debtor) => debtor.TotalDebtInDays ?? 0,
        align: 'right',
        width: 160,
        cell: (debtor) => moneyFormatter.format(debtor.TotalDebtInDays ?? 0),
      },
      {
        id: 'missedDays',
        header: t('Прострочено днів'),
        accessor: (debtor) => debtor.MissedDays ?? 0,
        align: 'right',
        width: 150,
        cell: (debtor) => (
          <Text c={(debtor.MissedDays ?? 0) < 0 ? 'red' : undefined} size="sm">
            {debtor.MissedDays ?? 0}
          </Text>
        ),
      },
      {
        id: 'remainderDebt',
        header: t('Залишок боргу'),
        accessor: (debtor) => debtor.RemainderDebt ?? 0,
        align: 'right',
        width: 170,
        cell: (debtor) => moneyFormatter.format(debtor.RemainderDebt ?? 0),
      },
      {
        id: 'overdueDebt',
        header: t('Прострочений борг'),
        accessor: (debtor) => debtor.OverdueDebt ?? 0,
        align: 'right',
        width: 170,
        cell: (debtor) => (
          <Text c={(debtor.OverdueDebt ?? 0) > 0 ? 'red' : undefined} size="sm">
            {moneyFormatter.format(debtor.OverdueDebt ?? 0)}
          </Text>
        ),
      },
    ],
    [days, t],
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
