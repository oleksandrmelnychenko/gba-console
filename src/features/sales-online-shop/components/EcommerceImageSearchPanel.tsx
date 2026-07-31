import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Image as ImageIcon,
  Languages,
  Link2,
  MapPin,
  MonitorSmartphone,
  Network,
  PackageSearch,
  RefreshCw,
  Search,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { realtimeEvents, useRealtimeEvent } from '../../../shared/realtime/events'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { Paginator } from '../../../shared/ui/paginator/Paginator'
import { DEFAULT_PAGINATOR_PAGE_SIZE } from '../../../shared/ui/paginator/paginatorPageSize'
import {
  getEcommerceImageSearch,
  getEcommerceImageSearches,
  getEcommerceImageSearchImageUrl,
} from '../api/salesOnlineShopApi'
import type {
  EcommerceImageSearchDetail,
  EcommerceImageSearchListItem,
  EcommerceImageSearchRequestMetadata,
  EcommerceImageSearchStatus,
} from '../types'
import './ecommerce-image-search-panel.css'

type StatusFilter = EcommerceImageSearchStatus | 'all'

const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { value: 'all', label: 'Усі стани' },
  { value: 'completed', label: 'Розпізнано' },
  { value: 'processing', label: 'Обробляється' },
  { value: 'failed', label: 'Помилка' },
]

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const integerFormatter = new Intl.NumberFormat('uk-UA')

type EcommerceImageSearchPanelProps = {
  initialSelectionNetUid?: string | null
}

export function EcommerceImageSearchPanel({
  initialSelectionNetUid,
}: EcommerceImageSearchPanelProps) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGINATOR_PAGE_SIZE)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [searchDraft, setSearchDraft] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [items, setItems] = useState<EcommerceImageSearchListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<EcommerceImageSearchDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectionNetUid ?? null)
  const [detailLoading, setDetailLoading] = useState(Boolean(initialSelectionNetUid))
  const [detailError, setDetailError] = useState<string | null>(null)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearchValue(searchDraft.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchDraft])

  const offset = (page - 1) * pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    async function load() {
      setLoading(true)

      try {
        const result = await getEcommerceImageSearches(
          {
            limit: pageSize,
            offset,
            status,
            value: searchValue,
          },
          controller.signal,
        )

        if (active) {
          setItems(Array.isArray(result?.Items) ? result.Items : [])
          setTotal(Number(result?.Total) || 0)
          setError(null)
        }
      } catch (loadError) {
        if (active && !controller.signal.aborted) {
          setItems([])
          setTotal(0)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити AI-пошуки'))
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
      controller.abort()
    }
  }, [offset, pageSize, reloadKey, searchValue, status, t])

  const openDetail = useCallback((netUid: string) => {
    setSelectedId(netUid)
    setSelected(null)
    setDetailError(null)
    setDetailLoading(true)
  }, [])

  useEffect(() => {
    if (!selectedId) {
      return
    }

    const netUid = selectedId
    const controller = new AbortController()

    async function loadDetail() {
      try {
        const detail = await getEcommerceImageSearch(netUid, controller.signal)

        if (!controller.signal.aborted) {
          setSelected(detail)
          setDetailError(null)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setDetailError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити AI-аналіз'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      controller.abort()
    }
  }, [selectedId, t])

  const closeDetail = useCallback(() => {
    setSelectedId(null)
    setSelected(null)
    setDetailError(null)
    setDetailLoading(false)
  }, [])

  useRealtimeEvent(realtimeEvents.ecommerceImageSearchCreated, reload)
  useRealtimeEvent(realtimeEvents.ecommerceImageSearchUpdated, reload)

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((option) => ({ ...option, label: t(option.label) })),
    [t],
  )

  return (
    <Stack className="ecommerce-image-search-panel" gap={6}>
      <Card className="app-filter-card image-search-audit-toolbar" withBorder radius="md" padding={0}>
        <div className="app-filter-bar">
          <div className="image-search-audit-filter-row">
            <TextInput
              className="image-search-audit-search"
              label={t('Пошук')}
              leftSection={<Search size={16} />}
              placeholder={t('Назва деталі, категорія, IP або SHA-256')}
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.currentTarget.value)}
            />
            <Select
              allowDeselect={false}
              className="image-search-audit-status"
              data={statusOptions}
              label={t('Стан')}
              value={status}
              onChange={(value) => {
                setPage(1)
                setStatus((value as StatusFilter | null) || 'all')
              }}
            />
            <div className="app-filter-actions image-search-audit-actions">
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  loading={isLoading}
                  size={34}
                  variant="light"
                  onClick={reload}
                >
                  <RefreshCw size={17} />
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
          </div>
        </div>
      </Card>

      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      <Card className="image-search-audit-list" withBorder radius="md" padding={0}>
        <div className="image-search-audit-list-head" aria-hidden="true">
          <span>{t('Фото / результат')}</span>
          <span>{t('Стан')}</span>
          <span>{t('Точність')}</span>
          <span>{t('Товарів')}</span>
          <span>{t('Час')}</span>
          <span>{t('Створено')}</span>
        </div>

        {isLoading && items.length === 0 ? (
          <div className="image-search-audit-loading">
            <Loader color="orange" size="sm" />
            <Text c="dimmed" size="sm">{t('Завантаження AI-пошуків')}</Text>
          </div>
        ) : items.length === 0 ? (
          <div className="image-search-audit-empty">
            <ImageIcon size={30} strokeWidth={1.5} />
            <Text fw={650}>{t('AI-пошуків ще немає')}</Text>
            <Text c="dimmed" size="sm">
              {t('Тут з’являтимуться фото покупців і результати розпізнавання')}
            </Text>
          </div>
        ) : (
          <div className={isLoading ? 'image-search-audit-rows is-reloading' : 'image-search-audit-rows'}>
            {items.map((item) => (
              <ImageSearchAuditRow
                key={item.NetUid}
                item={item}
                onOpen={() => openDetail(item.NetUid)}
              />
            ))}
          </div>
        )}
      </Card>

      <AppDrawer
        opened={Boolean(selectedId)}
        position="right"
        size="standard"
        title={t('AI-пошук за фото')}
        onClose={closeDetail}
      >
        {detailLoading ? (
          <div className="image-search-detail-loading">
            <Loader color="orange" size="sm" />
            <Text c="dimmed" size="sm">{t('Завантаження аналізу')}</Text>
          </div>
        ) : detailError ? (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {detailError}
          </Alert>
        ) : selected ? (
          <ImageSearchAuditDetail detail={selected} />
        ) : null}
      </AppDrawer>
    </Stack>
  )
}

function ImageSearchAuditRow({
  item,
  onOpen,
}: {
  item: EcommerceImageSearchListItem
  onOpen: () => void
}) {
  const { t } = useI18n()

  return (
    <button className="image-search-audit-row" type="button" onClick={onOpen}>
      <span className="image-search-audit-primary">
        <img
          alt=""
          className="image-search-audit-thumb"
          loading="lazy"
          src={getEcommerceImageSearchImageUrl(item.NetUid)}
        />
        <span className="image-search-audit-copy">
          <strong>{item.IdentifiedName || t('Очікуємо розпізнавання')}</strong>
          <small>
            {[item.Category, item.VehicleSystem, item.OriginalFileName].filter(Boolean).join(' · ')}
          </small>
          <span className="image-search-audit-origin">
            <UserRound size={12} />
            {item.IsAuthenticated ? t('Авторизований покупець') : t('Анонімний покупець')}
          </span>
        </span>
      </span>
      <span><StatusBadge status={item.Status} /></span>
      <span className="image-search-audit-mono">
        {typeof item.Confidence === 'number' ? `${item.Confidence}%` : '—'}
      </span>
      <span className="image-search-audit-mono">{integerFormatter.format(item.ProductCount || 0)}</span>
      <span className="image-search-audit-mono">{formatDuration(item.ProcessingMilliseconds)}</span>
      <span className="image-search-audit-date">{formatDateTime(item.CreatedAtUtc)}</span>
    </button>
  )
}

function ImageSearchAuditDetail({ detail }: { detail: EcommerceImageSearchDetail }) {
  const { t } = useI18n()
  const analysis = detail.Analysis
  const metadata = detail.RequestMetadata
  const application = analysis?.application ?? []
  const queries = analysis?.searchQueries ?? []
  const oem = analysis?.oem ?? []
  const location = [
    metadata?.City,
    metadata?.Region,
    metadata?.CountryCode,
  ].filter(Boolean).join(', ')
  const coordinates = metadata?.Latitude && metadata?.Longitude
    ? `${metadata.Latitude}, ${metadata.Longitude}`
    : ''
  const requestTarget = metadata?.RequestHost
    ? `${metadata.RequestProtocol ? `${metadata.RequestProtocol}://` : ''}${metadata.RequestHost}`
    : ''
  const device = [
    formatDeviceType(metadata?.DeviceType, t),
    metadata?.SecChUaPlatform,
  ].filter(Boolean).join(' · ')

  return (
    <Stack className="image-search-audit-detail" gap="md">
      <div className="image-search-detail-hero">
        <img
          alt={detail.IdentifiedName || t('Фото деталі')}
          className="image-search-detail-image"
          src={getEcommerceImageSearchImageUrl(detail.NetUid)}
        />
        <div className="image-search-detail-summary">
          <Group gap="xs">
            <StatusBadge status={detail.Status} />
            <Badge color="orange" variant="outline">
              {typeof detail.Confidence === 'number' ? `${detail.Confidence}%` : t('Без оцінки')}
            </Badge>
          </Group>
          <div>
            <Text className="image-search-detail-kicker">{t('AI ідентифікація')}</Text>
            <Text className="image-search-detail-title">
              {detail.IdentifiedName || t('Деталь не визначено')}
            </Text>
            {analysis?.nameEn && (
              <Text c="dimmed" ff="monospace" size="sm">{analysis.nameEn}</Text>
            )}
          </div>
          <div className="image-search-detail-facts">
            <Fact icon={<PackageSearch size={15} />} label={t('Знайдено товарів')} value={String(detail.ProductCount)} />
            <Fact icon={<Clock3 size={15} />} label={t('Час обробки')} value={formatDuration(detail.ProcessingMilliseconds)} />
            <Fact icon={<Bot size={15} />} label={t('Модель')} value={detail.AiModel || '—'} />
          </div>
        </div>
      </div>

      {detail.Status === 'failed' && (
        <Alert color="red" icon={<TriangleAlert size={18} />} title={detail.ErrorCode || t('Помилка обробки')}>
          {detail.ErrorMessage || t('AI-пошук завершився з помилкою')}
        </Alert>
      )}

      {analysis && (
        <>
          <section className="image-search-detail-section">
            <Text className="image-search-detail-section-title">{t('Опис')}</Text>
            <Text>{analysis.description || '—'}</Text>
          </section>

          <section className="image-search-detail-section">
            <Text className="image-search-detail-section-title">{t('Класифікація')}</Text>
            <div className="image-search-detail-chip-list">
              {[analysis.category, analysis.subcategory, analysis.system, analysis.material, analysis.dimensions]
                .filter(Boolean)
                .map((value) => <span key={value as string}>{value}</span>)}
            </div>
          </section>

          {application.length > 0 && (
            <section className="image-search-detail-section">
              <Text className="image-search-detail-section-title">{t('Застосування')}</Text>
              <div className="image-search-detail-chip-list is-blue">
                {application.map((value) => <span key={value}>{value}</span>)}
              </div>
            </section>
          )}

          {(oem.length > 0 || queries.length > 0) && (
            <div className="image-search-detail-two-column">
              <section className="image-search-detail-section">
                <Text className="image-search-detail-section-title">{t('OEM номери')}</Text>
                <div className="image-search-detail-code-list">
                  {oem.length > 0 ? oem.map((value) => <code key={value}>{value}</code>) : <Text c="dimmed">—</Text>}
                </div>
              </section>
              <section className="image-search-detail-section">
                <Text className="image-search-detail-section-title">{t('Пошукові запити')}</Text>
                <div className="image-search-detail-code-list">
                  {queries.map((value) => <code key={value}>{value}</code>)}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {metadata && (
        <section className="image-search-detail-section is-visitor">
          <div className="image-search-detail-section-heading">
            <Text className="image-search-detail-section-title">{t('Відвідувач і HTTP')}</Text>
            <Network aria-hidden="true" size={16} />
          </div>
          <div className="image-search-detail-metadata-grid">
            <MetadataFact
              icon={<Network size={15} />}
              label={t('IP-адреса')}
              value={metadata.ClientIpAddress}
              mono
            />
            <MetadataFact
              icon={<MonitorSmartphone size={15} />}
              label={t('Пристрій')}
              value={device}
            />
            <MetadataFact
              icon={<MapPin size={15} />}
              label={t('Локація')}
              value={location}
            />
            <MetadataFact
              icon={<Languages size={15} />}
              label={t('Мова браузера')}
              value={metadata.AcceptLanguage}
              mono
            />
            <MetadataFact
              icon={<Clock3 size={15} />}
              label={t('Часовий пояс')}
              value={metadata.TimeZone}
              mono
            />
            <MetadataFact
              icon={<MapPin size={15} />}
              label={t('Координати проксі')}
              value={coordinates}
              mono
            />
            <MetadataFact
              icon={<Link2 size={15} />}
              label={t('Сторінка входу')}
              value={metadata.Referrer}
              wide
            />
            <MetadataFact
              icon={<Network size={15} />}
              label={t('HTTP host')}
              value={requestTarget}
              mono
            />
            <MetadataFact
              icon={<MonitorSmartphone size={15} />}
              label="User-Agent"
              value={metadata.UserAgent}
              wide
              mono
            />
            <MetadataFact
              icon={<MonitorSmartphone size={15} />}
              label="Client hints"
              value={metadata.SecChUa}
              wide
              mono
            />
            <MetadataFact
              icon={<Network size={15} />}
              label={t('ID запиту проксі')}
              value={metadata.ProxyRequestId}
              wide
              mono
            />
          </div>
        </section>
      )}

      <section className="image-search-detail-section is-technical">
        <Text className="image-search-detail-section-title">{t('Технічні дані')}</Text>
        <dl>
          <div><dt>{t('Створено')}</dt><dd>{formatDateTime(detail.CreatedAtUtc)}</dd></div>
          <div><dt>{t('Файл')}</dt><dd>{detail.OriginalFileName}</dd></div>
          <div><dt>SHA-256</dt><dd><code>{detail.ImageSha256}</code></dd></div>
          <div><dt>{t('Запити каталогу')}</dt><dd>{detail.CatalogQueryCount}</dd></div>
          <div><dt>{t('Помилкові запити')}</dt><dd>{detail.CatalogFailedQueryCount}</dd></div>
        </dl>
      </section>
    </Stack>
  )
}

function StatusBadge({ status }: { status: EcommerceImageSearchStatus }) {
  const { t } = useI18n()
  const config = {
    completed: { color: 'teal', icon: <CheckCircle2 size={13} />, label: t('Розпізнано') },
    failed: { color: 'red', icon: <TriangleAlert size={13} />, label: t('Помилка') },
    processing: { color: 'orange', icon: <Clock3 size={13} />, label: t('Обробляється') },
  }[status]

  return (
    <Badge color={config.color} leftSection={config.icon} variant="light">
      {config.label}
    </Badge>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <span>{icon}{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MetadataFact({
  icon,
  label,
  value,
  mono = false,
  wide = false,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
  mono?: boolean
  wide?: boolean
}) {
  if (!value) {
    return null
  }

  return (
    <div className={wide ? 'image-search-detail-metadata-item is-wide' : 'image-search-detail-metadata-item'}>
      <span>{icon}{label}</span>
      <strong className={mono ? 'is-mono' : undefined}>{value}</strong>
    </div>
  )
}

function formatDeviceType(
  value: EcommerceImageSearchRequestMetadata['DeviceType'],
  t: (value: string) => string,
) {
  const labels: Record<string, string> = {
    bot: t('Бот'),
    desktop: t('Комп’ютер'),
    mobile: t('Телефон'),
    tablet: t('Планшет'),
    unknown: t('Невідомо'),
  }

  return value ? labels[String(value)] ?? String(value) : ''
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function formatDuration(value: number | null | undefined) {
  if (!value || value < 1) {
    return '—'
  }

  return value < 1_000 ? `${value} ms` : `${(value / 1_000).toFixed(1)} s`
}
