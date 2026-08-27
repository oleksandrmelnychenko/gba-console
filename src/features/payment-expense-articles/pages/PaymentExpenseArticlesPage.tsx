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
import { CircleAlert, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { usePermissions } from '../../auth/usePermissions'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { getPaymentExpenseArticles, searchPaymentExpenseArticles } from '../api/paymentExpenseArticlesApi'
import type { PaymentExpenseArticle } from '../types'
import '../../../shared/ui/console-table-page.css'
import './payment-expense-articles-page.css'

const PERMISSION_CREATE_EXPENSE_ARTICLE =
  PermissionKeys.FinancialAdministration.ExpenseArticles.Article.Create
const PERMISSION_VIEW_EXPENSE_ARTICLES =
  PermissionKeys.SystemPages.ExpenseArticles.View

const TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['operationName'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SEARCH_DEBOUNCE_MS = 350

type PaymentExpenseArticlesPageProps = {
  inSharedShell?: boolean
}

export function PaymentExpenseArticlesPage({ inSharedShell = false }: PaymentExpenseArticlesPageProps) {
  const { t } = useI18n()
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return <Text c="dimmed">{t('Завантаження')}</Text>
  }

  if (!can(PERMISSION_VIEW_EXPENSE_ARTICLES)) {
    return (
      <Alert color="red" icon={<CircleAlert size={18} />} title={t('Доступ заборонено')} variant="light">
        {t('Недостатньо прав для перегляду статей витрат')}
      </Alert>
    )
  }

  return <PaymentExpenseArticlesPageContent inSharedShell={inSharedShell} />
}

function PaymentExpenseArticlesPageContent({ inSharedShell = false }: PaymentExpenseArticlesPageProps) {
  const { t } = useI18n()
  const { can } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const [articles, setArticles] = useValueState<PaymentExpenseArticle[]>([])
  const [searchValue, setSearchValue] = useValueState('')
  const [debouncedSearchValue] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
  const normalizedSearchValue = debouncedSearchValue.trim()
  const isSearchSettling = searchValue.trim() !== normalizedSearchValue
  const isTableBusy = isLoading || isSearchSettling
  const canCreate = can(PERMISSION_CREATE_EXPENSE_ARTICLE)

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
        fill: true,
        minWidth: 260,
        accessor: (article) => article.OperationName,
        cell: (article) => displayValue(article.OperationName),
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
          <TableRowAction action="edit" label={t('Редагувати')} onClick={() => openArticle(article)} />
        ),
      },
    ],
    [openArticle, t],
  )

  useEffect(() => {
    const state = location.state as { mutated?: boolean } | null

    if (state?.mutated) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
      reload()
    }
  }, [location.pathname, location.search, location.state, navigate])

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

  const content = (
    <>
      <div className="app-filter-bar payment-expense-articles-filter-bar">
        <TextInput
          className="console-table-search-input"
          leftSection={<Search size={16} />}
          label={t('Пошук')}
          placeholder={t('Введіть назву статті')}
          value={searchValue}
          onChange={(event) => setSearchValue(event.currentTarget.value)}
        />
        <div className="app-filter-actions">
          <Tooltip label={t('Скинути')}>
            <ActionIcon
              aria-label={t('Скинути')}
              color="gray"
              disabled={!searchValue}
              size={34}
              variant="light"
              onClick={() => setSearchValue('')}
            >
              <RotateCcw size={17} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Оновити')}>
            <ActionIcon aria-label={t('Оновити')} color="gray" loading={isLoading} size={34} variant="light" onClick={reload}>
              <RefreshCw size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
        <div ref={setTableToolbarSlot} className="app-filter-table-toolbar-slot" />
        {canCreate && (
          <Button
            color={CREATE_ACTION_COLOR}
            leftSection={<Plus size={16} />}
            size="sm"
            styles={{ label: { fontFamily: 'var(--font-mono)', letterSpacing: 0 } }}
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
        )}
      </div>

      {error && (
        <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
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
          layoutVersion="payment-expense-articles-2"
          height="100%"
          minWidth={420}
          showLayoutControls
          tableId="payment-expense-articles"
          toolbarPortalTarget={tableToolbarSlot}
          onRowClick={openArticle}
        />
      </div>
    </>
  )

  if (inSharedShell) {
    return (
      <Stack className="payment-expense-articles-page console-table-page payment-articles-tab-content" gap={0}>
        {content}
      </Stack>
    )
  }

  return (
    <Stack className="payment-expense-articles-page console-table-page" gap={6}>
      <div className="console-table-shell">{content}</div>
    </Stack>
  )
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
