import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { CircleAlert, Pencil, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleTableEntityCell } from '../../../shared/ui/console-table-cells'
import { createConsoleTableMarker } from '../../../shared/ui/console-table-utils'
import '../../../shared/ui/console-table-page.css'
import { useAuth } from '../../auth/useAuth'
import { getPaymentCashflowArticles, searchPaymentCashflowArticles } from '../api/paymentCashflowArticlesApi'
import type { PaymentCashflowArticle } from '../types'
import './payment-cashflow-articles-page.css'

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
  const [tableToolbarSlot, setTableToolbarSlot] = useState<HTMLDivElement | null>(null)
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
        cell: (article) => (
          <ConsoleTableEntityCell
            marker={createConsoleTableMarker(article.OperationName || '')}
            title={displayValue(article.OperationName)}
          />
        ),
      },
      {
        id: 'netUid',
        header: 'NetUid',
        width: 320,
        minWidth: 300,
        accessor: (article) => article.NetUid,
        cell: (article) => (
          <Text c="dimmed" size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0, whiteSpace: 'nowrap' }}>
            {displayValue(article.NetUid)}
          </Text>
        ),
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
              color="gray"
              variant="subtle"
              onClick={(event) => {
                event.stopPropagation()
                openArticle(article)
              }}
            >
              <Pencil size={18} />
            </ActionIcon>
          </Tooltip>
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

  return (
    <Stack className="payment-cashflow-articles-page console-table-page" gap={6}>
      <div className="console-table-shell payment-cashflow-articles-card">
        <div className="app-filter-bar payment-cashflow-articles-filter-bar">
          <Group align="end" gap={10} wrap="nowrap" className="payment-cashflow-articles-filter-row">
            <TextInput
              size="sm"
              leftSection={<Search size={16} />}
              label={t('Пошук')}
              placeholder={t('Пошук')}
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
              style={{ flex: '1 1 auto', minWidth: 180 }}
            />
            <div className="app-filter-actions">
              <Tooltip label={t('Скинути')}>
                <ActionIcon
                  aria-label={t('Скинути')}
                  color="gray"
                  size={34}
                  variant="light"
                  onClick={() => setSearchValue('')}
                >
                  <RotateCcw size={17} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  color="gray"
                  loading={isLoading}
                  size={34}
                  variant="light"
                  onClick={reload}
                >
                  <RefreshCw size={17} />
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
        </div>

        {error && (
          <Alert className="console-table-alert" color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="payment-cashflow-articles-page__table console-table-body">
          <DataTable
            columns={columns}
            data={articles}
            defaultLayout={PAYMENT_CASHFLOW_ARTICLES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Статей руху коштів не знайдено')}
            getRowId={(article, index) => String(article.NetUid || article.Id || index)}
            height="100%"
            isLoading={isTableBusy}
            layoutVersion="payment-cashflow-articles-table-1"
            loadingText={t('Завантаження статей руху коштів')}
            minWidth={720}
            showLayoutControls
            tableId="payment-cashflow-articles"
            toolbarPortalTarget={tableToolbarSlot}
            onRowClick={openArticle}
          />
        </div>
      </div>
    </Stack>
  )
}

function displayValue(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : ''
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
