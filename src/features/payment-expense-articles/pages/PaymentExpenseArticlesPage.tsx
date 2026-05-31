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
import { getPaymentExpenseArticles, searchPaymentExpenseArticles } from '../api/paymentExpenseArticlesApi'
import type { PaymentExpenseArticle } from '../types'

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

  const openArticle = useCallback(
    (article: PaymentExpenseArticle) => {
      if (!article.NetUid) {
        return
      }

      navigate(`/accounting/payment-expense-articles/edit/${article.NetUid}`, {
        state: {
          backgroundLocation: location,
          nodeTitle: article.OperationName,
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

  const toolbarLeft = (
    <TextInput
      leftSection={<IconSearch size={16} />}
      placeholder={t('Пошук')}
      value={searchValue}
      w={{ base: '100%', sm: 360 }}
      onChange={(event) => setSearchValue(event.currentTarget.value)}
    />
  )

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700} size="xl">
                {t('Статті витрат')}
              </Text>
            </div>

            <Group gap="xs">
              <Tooltip label={t('Оновити')}>
                <ActionIcon aria-label={t('Оновити')} loading={isLoading} variant="light" onClick={reload}>
                  <IconRefresh size={18} />
                </ActionIcon>
              </Tooltip>
              <Button
                color="violet"
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
            defaultLayout={TABLE_DEFAULT_LAYOUT}
            emptyText={t('Статей витрат не знайдено')}
            getRowId={(article) => String(article.NetUid || article.Id || article.OperationName)}
            isLoading={isTableBusy}
            layoutVersion="payment-expense-articles-1"
            tableId="payment-expense-articles"
            toolbarLeft={toolbarLeft}
            onRowClick={openArticle}
          />
        </Stack>
      </Card>
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
