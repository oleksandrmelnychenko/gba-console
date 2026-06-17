import {
  ActionIcon,
  Alert,
  Button,
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
import { ConsoleTableEntityCell } from '../../../shared/ui/console-table-cells'
import { createConsoleTableMarker } from '../../../shared/ui/console-table-utils'
import { useAuth } from '../../auth/useAuth'
import { getPaymentExpenseArticles, searchPaymentExpenseArticles } from '../api/paymentExpenseArticlesApi'
import type { PaymentExpenseArticle } from '../types'
import '../../../shared/ui/console-table-page.css'

const PERMISSION_CREATE_EXPENSE_ARTICLE = 'Accounting_Payment_Expense_Articles_ADDBtn_PKEY'

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['operationName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SEARCH_DEBOUNCE_MS = 350

export function PaymentExpenseArticlesPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [articles, setArticles] = useValueState<PaymentExpenseArticle[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isSearchSettling
  const canCreate = hasPermission(PERMISSION_CREATE_EXPENSE_ARTICLE)

  const openArticle = useCallback(
    (article: PaymentExpenseArticle) => {
      if (!article.NetUid) {
        return
      }

      navigate(`/accounting/payment-expense-articles/edit/${article.NetUid}`, {
        state: {
          nodeTitle: article.OperationName,
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
        },
      })
    },
    [location, navigate],
  )

  const columns = useMemo<DataTableColumn<PaymentExpenseArticle>[]>(
    () => [
      {
        id: 'operationName',
        header: t('Назва'),
        minWidth: 260,
        accessor: (article) => article.OperationName,
        cell: (article) => (
          <ConsoleTableEntityCell
            marker={createConsoleTableMarker(article.OperationName)}
            title={displayValue(article.OperationName)}
            subtitle={displayValue(article.NetUid)}
          />
        ),
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
          ? await searchPaymentExpenseArticles(normalizedSearchValue)
          : await getPaymentExpenseArticles()

        if (!controller.signal.aborted) {
          setArticles(nextArticles)
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити статті витрат'))
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

  return (
    <Stack className="payment-expense-articles-page console-table-page" gap="md">
      {canCreate && (
        <PageHeaderActions>
          <Button
            color={CREATE_ACTION_COLOR}
            size="sm"
            leftSection={<IconPlus size={16} />}
            onClick={() =>
              navigate('/accounting/payment-expense-articles/new', {
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
      <div className="console-table-shell">
        <div className="console-table-command-bar is-search-only">
          <TextInput
            className="console-table-search-input"
            leftSection={<IconSearch size={16} />}
            label={t('Пошук')}
            placeholder={t('Назва або NetUid')}
            value={searchValue}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
          <div className="console-table-actions">
            <span className="console-table-summary">{t('Статей')}: {articles.length}</span>
            <Tooltip label={t('Оновити')}>
              <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={38} variant="light" onClick={reload}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="payment-expense-articles-page__table console-table-body">
          <DataTable
            columns={columns}
            data={articles}
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Статей витрат не знайдено')}
            getRowId={(article) => String(article.NetUid || article.Id || article.OperationName)}
            isLoading={isTableBusy}
            layoutVersion="payment-expense-articles-1"
            height="100%"
            tableId="payment-expense-articles"
            onRowClick={openArticle}
          />
        </div>
      </div>
    </Stack>
  )
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  return value || '—'
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
