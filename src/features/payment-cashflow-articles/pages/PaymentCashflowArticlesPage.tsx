import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconAlertCircle, IconPencil, IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR, PageHeaderActions } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useAuth } from '../../auth/useAuth'
import { getPaymentCashflowArticles, searchPaymentCashflowArticles } from '../api/paymentCashflowArticlesApi'
import type { PaymentCashflowArticle } from '../types'

const PERMISSION_CREATE_CASHFLOW_ARTICLE = 'Accounting_Payment_Cashflow_Articles_AddBtn_PKEY'

const PAYMENT_CASHFLOW_ARTICLES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['operationName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SEARCH_DEBOUNCE_MS = 350

export function PaymentCashflowArticlesPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [articles, setArticles] = useValueState<PaymentCashflowArticle[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isSearchSettling
  const canCreate = hasPermission(PERMISSION_CREATE_CASHFLOW_ARTICLE)

  const openArticle = useCallback(
    (article: PaymentCashflowArticle) => {
      if (!article.NetUid) {
        return
      }

      navigate(`/accounting/payment-cashflow-articles/edit/${article.NetUid}`, {
        state: {
          nodeTitle: article.OperationName,
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

  const columns = useMemo<DataTableColumn<PaymentCashflowArticle>[]>(
    () => [
      {
        id: 'operationName',
        header: t('Назва'),
        minWidth: 260,
        accessor: (article) => article.OperationName,
        cell: (article) => <Text fw={600}>{displayValue(article.OperationName)}</Text>,
      },
      {
        id: 'netUid',
        header: 'NetUid',
        width: 280,
        minWidth: 220,
        accessor: (article) => article.NetUid,
        cell: (article) => <Text c="dimmed">{displayValue(article.NetUid)}</Text>,
      },
      {
        id: 'actions',
        header: '',
        width: 72,
        minWidth: 72,
        align: 'center',
        enableSorting: false,
        enableHiding: false,
        cell: (article) => (
          <Tooltip label={t('Редагувати')}>
            <ActionIcon
              aria-label={t('Редагувати')}
              color="violet"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                openArticle(article)
              }}
            >
              <IconPencil size={18} />
            </ActionIcon>
          </Tooltip>
        ),
      },
    ],
    [openArticle, t],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadArticles() {
      setLoading(true)
      setError(null)

      try {
        const nextArticles = normalizedSearchValue
          ? await searchPaymentCashflowArticles(normalizedSearchValue)
          : await getPaymentCashflowArticles()

        if (!controller.signal.aborted) {
          setArticles(nextArticles)
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити статті руху коштів'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadArticles()

    return () => controller.abort()
  }, [normalizedSearchValue, reloadKey, setArticles, setError, setLoading, t])

  const toolbarLeft = useMemo(
    () => (
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder={t('Пошук')}
        value={searchValue}
        w={{ base: '100%', sm: 360 }}
        onChange={(event) => setSearchValue(event.currentTarget.value)}
      />
    ),
    [searchValue, setSearchValue, t],
  )

  return (
    <Stack gap="md">
      {canCreate && (
        <PageHeaderActions>
          <Button
            color={CREATE_ACTION_COLOR}
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() =>
              navigate('/accounting/payment-cashflow-articles/new', {
                state: {
                  backgroundLocation: location,
                  returnPath: `${location.pathname}${location.search}`,
                },
              })
            }
          >
            {t('Нова стаття')}
          </Button>
        </PageHeaderActions>
      )}
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="flex-end" wrap="wrap">
            <Group gap="xs">
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              {canCreate && (
                <Button
                  color="violet"
                  leftSection={<IconPlus size={16} />}
                  onClick={() =>
                    navigate('/accounting/payment-cashflow-articles/new', {
                      state: {
                        backgroundLocation: location,
                        returnPath: `${location.pathname}${location.search}`,
                      },
                    })
                  }
                >
                  {t('Нова стаття')}
                </Button>
              )}
            </Group>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={articles}
            defaultLayout={PAYMENT_CASHFLOW_ARTICLES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Статей руху коштів не знайдено')}
            getRowId={(article, index) => String(article.NetUid || article.Id || index)}
            isLoading={isTableBusy}
            layoutVersion="payment-cashflow-articles-table-1"
            loadingText={t('Завантаження статей руху коштів')}
            maxHeight="calc(100vh - 260px)"
            minWidth={720}
            tableId="payment-cashflow-articles"
            toolbarLeft={toolbarLeft}
            onRowClick={openArticle}
          />
        </Stack>
      </Card>
    </Stack>
  )
}

function displayValue(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '—'
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
