import { Anchor, Button, Group, Text, TextInput } from '@mantine/core'
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Copy,
  Clock3,
  ExternalLink,
  FileCode2,
  Globe2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../shared/api/apiClient'
import { AiFeatureBadge } from '../../../shared/ai/AiFeatureBadge'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { SalesUkraineProduct } from '../../sales-ukraine/types'
import { searchCompetitorPrices } from '../api/pricingApi'
import type {
  CompetitorPriceOffer,
  CompetitorPriceSearchResult,
  CompetitorSourceKey,
} from '../pricingTypes'
import { COMPETITOR_SEARCH_PROMPT } from './competitorSearchPrompt'
import './competitor-web-search-panel.css'

type CompetitorWebSearchPanelProps = {
  product: SalesUkraineProduct | null
}

type CompetitorSource = {
  key: CompetitorSourceKey
  label: string
  shortLabel: string
  priority: number
  accessLabel: string | null
  accessHint: string
  buildUrl: (query: string) => string
}

type SearchStatus = 'idle' | 'loading' | 'success' | 'error' | 'unavailable'

const COMPETITOR_SOURCES: CompetitorSource[] = [
  {
    key: 'strans',
    label: 'STRANS',
    shortLabel: 'STR',
    priority: 1,
    accessLabel: 'ГОЛОВНИЙ',
    accessHint: 'Головний конкурент: публічні ціни, наявність і мережа складів',
    buildUrl: (query) => `https://strans-shop.com.ua/search/product/${encodeURIComponent(query)}`,
  },
  {
    key: 'cargo_parts',
    label: 'Cargo Parts',
    shortLabel: 'CRGO',
    priority: 2,
    accessLabel: 'B2B',
    accessHint: 'Ціна доступна лише після входу в B2B',
    buildUrl: () => 'https://www.cargo-parts.ua/b2b/login',
  },
  {
    key: 'intercars',
    label: 'Inter Cars',
    shortLabel: 'IC',
    priority: 3,
    accessLabel: null,
    accessHint: 'Inter Cars Ukraine; сайт може виконувати перевірку браузера',
    buildUrl: (query) => buildSiteSearchUrl('webshop-ua.intercars.eu', query),
  },
  {
    key: 'omega',
    label: 'Омега',
    shortLabel: 'OMG',
    priority: 4,
    accessLabel: 'B2B',
    accessHint: 'Асортимент публічний, ціна доступна після входу для партнерів',
    buildUrl: () => 'https://omega.page/spare',
  },
  {
    key: 'tir_market',
    label: 'TIR Market',
    shortLabel: 'TIR',
    priority: 5,
    accessLabel: 'ВОЛИНЬ',
    accessHint: 'Партнер-конкурент із власним імпортом і сильним покриттям Волині',
    buildUrl: (query) => `https://tirmarket.com.ua/?s=${encodeURIComponent(query)}`,
  },
]

const DEFAULT_SOURCES = COMPETITOR_SOURCES.map((source) => source.key)

function buildSiteSearchUrl(domain: string, query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`
}

function buildDefaultQuery(product: SalesUkraineProduct | null): string {
  if (!product) {
    return ''
  }

  const parts = [product.MainOriginalNumber, product.VendorCode, product.Name ?? product.NameUA]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const unique = parts.filter((part) => {
    const key = part.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })

  return unique.join(' ')
}

export function CompetitorWebSearchPanel({ product }: CompetitorWebSearchPanelProps) {
  const initialQuery = buildDefaultQuery(product)

  return (
    <CompetitorWebSearchPanelContent
      key={`${product?.NetUid || 'manual'}:${initialQuery}`}
      initialQuery={initialQuery}
      productNetUid={product?.NetUid || null}
    />
  )
}

function CompetitorWebSearchPanelContent({
  initialQuery,
  productNetUid,
}: {
  initialQuery: string
  productNetUid: string | null
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState(initialQuery)
  const [selectedSources, setSelectedSources] = useState<CompetitorSourceKey[]>(DEFAULT_SOURCES)
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [result, setResult] = useState<CompetitorPriceSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const trimmedQuery = query.trim()
  const searchDisabled = trimmedQuery.length < 2 || selectedSources.length === 0 || status === 'loading'

  useEffect(() => () => controllerRef.current?.abort(), [])

  const toggleSource = (source: CompetitorSourceKey) => {
    setSelectedSources((current) => (
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source]
    ))
  }

  const runSearch = async () => {
    if (searchDisabled) {
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setStatus('loading')
    setError(null)

    try {
      const nextResult = await searchCompetitorPrices({
        market: 'UA',
        product_net_uid: productNetUid,
        query: trimmedQuery,
        sources: selectedSources,
      }, controller.signal)

      setResult(nextResult)
      setStatus('success')
    } catch (searchError) {
      if (controller.signal.aborted) {
        return
      }

      if (searchError instanceof ApiError && (searchError.status === 404 || searchError.status === 405)) {
        setStatus('unavailable')
        setError(t('AI-сканер підготовлений у консолі й очікує підключення сервісу збору цін.'))
        return
      }

      setStatus('error')
      setError(searchError instanceof Error ? searchError.message : t('Не вдалося просканувати ринок'))
    }
  }

  return (
    <div className="competitor-radar">
      <div className="competitor-radar__hero">
        <div className="competitor-radar__header">
          <div className="competitor-radar__heading">
            <Group gap={8} wrap="wrap">
              <Text className="competitor-radar__title">{t('Знайти реальну ціну на ринку')}</Text>
              <AiFeatureBadge size="sm" tooltip={t('AI-пошук і зіставлення ринкових пропозицій')} />
            </Group>
          </div>

          <div className="competitor-radar__market-pill">
            <span aria-hidden="true" />
            UA · UAH
          </div>
        </div>

        <Text className="competitor-radar__lead">
          {t('AI перевірить 5 ключових конкурентів у заданому пріоритеті, відсіє неточні збіги та покаже ціновий коридор.')}
        </Text>

        <div className="competitor-radar__search-row">
          <TextInput
            aria-label={t('Пошуковий запит')}
            className="competitor-radar__query"
            leftSection={<Search size={17} strokeWidth={2} />}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void runSearch()
              }
            }}
            placeholder={t('OE номер, артикул або точна назва товару')}
            value={query}
          />
          <Button
            className="competitor-radar__search-button"
            disabled={searchDisabled}
            leftSection={status === 'loading' ? undefined : <Sparkles size={16} />}
            loading={status === 'loading'}
            onClick={() => void runSearch()}
          >
            {status === 'loading' ? t('Сканую ринок') : t('Знайти ціни')}
          </Button>
        </div>

        <div className="competitor-radar__source-row" aria-label={t('Джерела пошуку')}>
          <Text className="competitor-radar__source-label">{t('Джерела')}</Text>
          {COMPETITOR_SOURCES.map((source) => {
            const active = selectedSources.includes(source.key)
            return (
              <button
                aria-checked={active}
                className={`competitor-radar__source${active ? ' is-active' : ''}`}
                key={source.key}
                onClick={() => toggleSource(source.key)}
                role="checkbox"
                title={t(source.accessHint)}
                type="button"
              >
                <span className="competitor-radar__source-check">
                  {active && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="competitor-radar__source-rank">{source.priority}</span>
                {source.label}
                {source.accessLabel && (
                  <span className="competitor-radar__source-access">{t(source.accessLabel)}</span>
                )}
              </button>
            )
          })}
        </div>

        <PromptDisclosure />
      </div>

      <div className="competitor-radar__body">
        {status === 'loading' ? (
          <ScanningState selectedSources={selectedSources} />
        ) : status === 'success' && result ? (
          <SearchResults result={result} onRefresh={() => void runSearch()} />
        ) : status === 'error' || status === 'unavailable' ? (
          <SearchFallback error={error} query={trimmedQuery} status={status} />
        ) : (
          <RadarEmptyState hasProduct={Boolean(productNetUid)} />
        )}

        <QuickSearchLinks disabled={trimmedQuery.length < 2} query={trimmedQuery} />
      </div>
    </div>
  )
}

function PromptDisclosure() {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const panelId = useId()

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(COMPETITOR_SEARCH_PROMPT)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={`competitor-radar__prompt${expanded ? ' is-expanded' : ''}`}>
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        aria-label={expanded ? t('Згорнути промпт Anthropic') : t('Показати промпт Anthropic')}
        className="competitor-radar__prompt-toggle"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="competitor-radar__prompt-icon" aria-hidden="true">
          <FileCode2 size={16} />
        </span>
        <span className="competitor-radar__prompt-heading">
          <span className="competitor-radar__prompt-kicker">SYSTEM PROMPT · READ ONLY</span>
          <span className="competitor-radar__prompt-title">{t('Як Anthropic шукає та перевіряє ціни')}</span>
        </span>
        <span className="competitor-radar__prompt-metric">13 {t('правил доказовості')}</span>
        <span className="competitor-radar__prompt-action">
          {expanded ? t('Згорнути') : t('Розгорнути')}
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </button>

      {expanded && (
        <div className="competitor-radar__prompt-panel" id={panelId}>
          <div className="competitor-radar__prompt-toolbar">
            <div className="competitor-radar__prompt-tags" aria-label={t('Параметри промпту')}>
              <span>claude-sonnet-5</span>
              <span>web_search</span>
              <span>UA · UAH</span>
            </div>
            <button
              className={`competitor-radar__prompt-copy${copied ? ' is-copied' : ''}`}
              onClick={() => void copyPrompt()}
              type="button"
            >
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {copied ? t('Скопійовано') : t('Копіювати')}
            </button>
          </div>

          <pre className="competitor-radar__prompt-code" data-testid="competitor-search-prompt">
            <code>{COMPETITOR_SEARCH_PROMPT}</code>
          </pre>

          <div className="competitor-radar__prompt-note">
            <ShieldCheck size={13} aria-hidden="true" />
            {t('Запит товару додається окремо та обробляється як недовірені дані.')}
          </div>
        </div>
      )}
    </section>
  )
}

function RadarEmptyState({ hasProduct }: { hasProduct: boolean }) {
  const { t } = useI18n()

  return (
    <div className="competitor-radar__empty">
      <div className="competitor-radar__empty-copy">
        <Text className="competitor-radar__empty-title">
          {hasProduct ? t('Запит сформовано з картки товару') : t('Введіть товар — решту зробить радар')}
        </Text>
        <Text className="competitor-radar__empty-text">
          {t('Перевіримо код, бренд і назву; дублікати магазинів та нерелевантні модифікації не потраплять у підсумок.')}
        </Text>
      </div>
      <div className="competitor-radar__trust-list">
        <span><ShieldCheck size={15} /> {t('лише UA')}</span>
        <span><ShoppingBag size={15} /> {t('ціна + наявність')}</span>
        <span><Sparkles size={15} /> {t('AI-збіг')}</span>
      </div>
    </div>
  )
}

function ScanningState({ selectedSources }: { selectedSources: CompetitorSourceKey[] }) {
  const { t } = useI18n()

  return (
    <div className="competitor-radar__scanning" role="status">
      <div>
        <Text className="competitor-radar__empty-title">{t('Сканую український ринок…')}</Text>
        <Text className="competitor-radar__empty-text">
          {t('Зіставляю артикул, відсіюю дублікати й нормалізую ціни з ПДВ.')}
        </Text>
      </div>
      <span className="competitor-radar__scan-count">{selectedSources.length} {t('джерел')}</span>
    </div>
  )
}

function SearchFallback({
  error,
  query,
  status,
}: {
  error: string | null
  query: string
  status: SearchStatus
}) {
  const { t } = useI18n()

  return (
    <div className={`competitor-radar__notice${status === 'error' ? ' is-error' : ''}`} role="alert">
      <span className="competitor-radar__notice-icon">
        <CircleAlert size={18} />
      </span>
      <div>
        <Text className="competitor-radar__notice-title">
          {status === 'unavailable' ? t('Інтерфейс готовий — потрібен backend worker') : t('Сканування не завершено')}
        </Text>
        <Text className="competitor-radar__notice-copy">{error}</Text>
        {query && (
          <Text className="competitor-radar__notice-hint">
            {t('Нижче вже доступні точкові пошуки по кожному майданчику.')}
          </Text>
        )}
      </div>
    </div>
  )
}

function SearchResults({
  onRefresh,
  result,
}: {
  onRefresh: () => void
  result: CompetitorPriceSearchResult
}) {
  const { t } = useI18n()
  const offers = useMemo(
    () => [...result.offers].sort((left, right) => left.price_uah - right.price_uah),
    [result.offers],
  )
  const prices = offers.map((offer) => offer.price_uah)
  const median = getMedian(prices)
  const uniqueStores = new Set(offers.map((offer) => offer.seller_name || offer.marketplace_name)).size

  if (offers.length === 0) {
    return (
      <div className="competitor-radar__notice">
        <span className="competitor-radar__notice-icon"><Search size={18} /></span>
        <div>
          <Text className="competitor-radar__notice-title">{t('Точних пропозицій не знайдено')}</Text>
          <Text className="competitor-radar__notice-copy">
            {t('Спробуйте залишити лише артикул або оригінальний номер без назви товару.')}
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div className="competitor-radar__results">
      <div className="competitor-radar__results-head">
        <div>
          <Group gap={8}>
            <span className="competitor-radar__live-dot" aria-hidden="true" />
            <Text className="competitor-radar__results-title">{t('Ринок знайдено')}</Text>
          </Group>
          <Text className="competitor-radar__timestamp">
            <Clock3 size={12} /> {formatScanTime(result.searched_at)}
          </Text>
        </div>
        <Button
          className="competitor-radar__refresh"
          leftSection={<RefreshCw size={14} />}
          onClick={onRefresh}
          size="xs"
          variant="subtle"
        >
          {t('Оновити')}
        </Button>
      </div>

      <div className="competitor-radar__stats">
        <MarketStat label={t('від')} value={formatUah(prices[0])} />
        <MarketStat label={t('медіана')} primary value={formatUah(median)} />
        <MarketStat label={t('до')} value={formatUah(prices[prices.length - 1])} />
        <MarketStat label={t('продавців')} value={String(uniqueStores)} />
      </div>

      {result.ai_summary && (
        <div className="competitor-radar__insight">
          <span><Sparkles size={15} /></span>
          <div>
            <Text className="competitor-radar__insight-label">AI ВИСНОВОК</Text>
            <Text className="competitor-radar__insight-copy">{result.ai_summary}</Text>
          </div>
        </div>
      )}

      <div className="competitor-radar__offers">
        {offers.slice(0, 6).map((offer, index) => (
          <OfferRow key={`${offer.url}:${index}`} median={median} offer={offer} />
        ))}
      </div>
    </div>
  )
}

function MarketStat({ label, primary, value }: { label: string; primary?: boolean; value: string }) {
  return (
    <div className={`competitor-radar__stat${primary ? ' is-primary' : ''}`}>
      <Text className="competitor-radar__stat-label">{label}</Text>
      <Text className="competitor-radar__stat-value">{value}</Text>
    </div>
  )
}

function OfferRow({ median, offer }: { median: number; offer: CompetitorPriceOffer }) {
  const { t } = useI18n()
  const source = COMPETITOR_SOURCES.find((item) => item.key === offer.source)
  const delta = median > 0 ? ((offer.price_uah - median) / median) * 100 : 0

  return (
    <Anchor className="competitor-radar__offer" href={offer.url} rel="noreferrer" target="_blank" underline="never">
      <span className="competitor-radar__offer-source">{source?.shortLabel || 'WEB'}</span>
      <span className="competitor-radar__offer-copy">
        <Text className="competitor-radar__offer-title" lineClamp={1}>{offer.title}</Text>
        <Text className="competitor-radar__offer-meta" lineClamp={1}>
          {offer.seller_name || offer.marketplace_name}
          {offer.delivery_text ? ` · ${offer.delivery_text}` : ''}
        </Text>
      </span>
      <span className="competitor-radar__offer-match">
        {Math.round(offer.similarity_score * 100)}% {t('збіг')}
      </span>
      <span className="competitor-radar__offer-price">
        <strong>{formatUah(offer.price_uah)}</strong>
        <small className={delta <= 0 ? 'is-good' : ''}>
          {formatDelta(delta)} {t('до медіани')}
        </small>
      </span>
      <ArrowUpRight size={16} />
    </Anchor>
  )
}

function QuickSearchLinks({ disabled, query }: { disabled: boolean; query: string }) {
  const { t } = useI18n()

  return (
    <div className="competitor-radar__quick-links">
      <div className="competitor-radar__quick-label">
        <Store size={14} />
        <span>{t('Швидка перевірка вручну')}</span>
      </div>
      <div className="competitor-radar__quick-list">
        {COMPETITOR_SOURCES.map((source) => disabled ? (
          <span className="competitor-radar__quick-link is-disabled" key={source.key}>
            {source.label}
          </span>
        ) : (
          <Anchor
            className="competitor-radar__quick-link"
            href={source.buildUrl(query)}
            key={source.key}
            rel="noreferrer"
            target="_blank"
            underline="never"
          >
            {source.label} <ExternalLink size={11} />
          </Anchor>
        ))}
      </div>
      <span className="competitor-radar__safe-note"><Globe2 size={12} /> {t('відкриється у новій вкладці')}</span>
    </div>
  )
}

function getMedian(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const middle = Math.floor(values.length / 2)
  return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle]
}

function formatUah(value: number): string {
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(value)} ₴`
}

function formatDelta(value: number): string {
  if (Math.abs(value) < 0.05) {
    return '0%'
  }
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`
}

function formatScanTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date)
}
