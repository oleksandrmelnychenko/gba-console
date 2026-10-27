import { Group, Loader, Portal, Text, Tooltip, Transition } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { TriangleAlert } from 'lucide-react'
import './currency-rates.css'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useExchangeRates } from '../hooks/useExchangeRates'
import type { ExchangeRate, ExchangeRateFreshness, ExchangeRateGroup } from '../types'
import { buildExchangeRateGroups, formatBusinessDate, formatRate, getRateKey } from '../utils'
import { CurrencyRatesPanel } from './CurrencyRatesPanel'

const PANEL_WIDTH = 520
const PANEL_GAP = 10

export function CurrencyRatesFooter() {
  const { data, error, isLoading, refresh } = useExchangeRates()
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const buttonRefsRef = useRef<Map<string, HTMLButtonElement> | null>(null)
  if (buttonRefsRef.current === null) buttonRefsRef.current = new Map()
  const buttonRefs = buttonRefsRef.current
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null)

  const groups = useMemo(
    () =>
      data
        ? buildExchangeRateGroups(data, {
            commercialCross: t('Крос'),
            commercialPln: 'PLN',
            commercialUah: 'UAH',
            governmentCross: t('НБУ крос'),
            governmentPln: t('НБУ PLN'),
            governmentUah: t('НБУ UAH'),
          })
        : [],
    [data, t],
  )

  const closePanel = useCallback(() => {
    if (selectedGroupId) buttonRefs.get(selectedGroupId)?.focus()
    setIsPanelOpen(false)
  }, [buttonRefs, selectedGroupId])

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null

  const computePanelStyle = useCallback((id: string): CSSProperties | null => {
    const btn = buttonRefs.get(id)
    if (!btn) return null
    const rect = btn.getBoundingClientRect()
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 12))
    return {
      left,
      right: 'auto',
      bottom: window.innerHeight - rect.top + PANEL_GAP,
    }
  }, [buttonRefs])
  const recomputePanelStyle = useEffectEvent((id: string) => computePanelStyle(id))

  const toggleGroup = useCallback(
    (group: ExchangeRateGroup) => {
      if (selectedGroupId === group.id && isPanelOpen) {
        closePanel()
        return
      }
      setPanelStyle(computePanelStyle(group.id))
      setSelectedGroupId(group.id)
      setIsPanelOpen(true)
    },
    [computePanelStyle, selectedGroupId, isPanelOpen, closePanel],
  )

  useEffect(() => {
    if (!selectedGroupId) return undefined
    const recompute = () => setPanelStyle(recomputePanelStyle(selectedGroupId))
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [selectedGroupId])

  if (isLoading) {
    return (
      <Group className="rates-footer-state" gap="xs" wrap="nowrap">
        <Loader size={14} color="white" />
        <Text size="xs" className="rates-footer-state">
          {t('Завантаження')}
        </Text>
      </Group>
    )
  }

  if (error) {
    return (
      <Text size="xs" className="rates-footer-state is-error">
        {t('Курси недоступні')}
      </Text>
    )
  }

  if (!data || groups.length === 0) {
    return (
      <Text size="xs" className="rates-footer-state">
        {t('Немає даних')}
      </Text>
    )
  }

  return (
    <>
      <Group gap={0} wrap="nowrap" className="rates-footer-groups" aria-label={t('Курси валют')}>
        {data.freshness?.IsCommercialRateStale && <StaleCommercialRate freshness={data.freshness} />}
        {groups.map((group) => (
          <RateGroup
            key={group.id}
            group={group}
            isSelected={isPanelOpen && selectedGroupId === group.id}
            onClick={() => toggleGroup(group)}
            buttonRef={(el) => {
              if (el) buttonRefs.set(group.id, el)
              else buttonRefs.delete(group.id)
            }}
          />
        ))}
      </Group>
      {selectedGroup && (
        <Portal>
          <Transition mounted={isPanelOpen} transition="slide-up" duration={reduceMotion ? 0 : 180}
            onExited={() => { setSelectedGroupId(null); setPanelStyle(null) }}>
            {(transitionStyle) => <CurrencyRatesPanel
              key={selectedGroup.id}
              group={selectedGroup}
              opened={isPanelOpen}
              onClose={closePanel}
              onRefresh={refresh}
              style={{ ...panelStyle, ...transitionStyle, pointerEvents: isPanelOpen ? 'auto' : 'none' }}
            />}
          </Transition>
        </Portal>
      )}
    </>
  )
}

function StaleCommercialRate({ freshness }: { freshness: ExchangeRateFreshness }) {
  const { t } = useI18n()
  const date = formatBusinessDate(freshness.CommercialRateDate)
  const details = date
    ? t('Комерційний курс не оновлювався з {date}. Ціни продажу, борг у EUR, кошик, форми 40/41 та NBA рахуються за ним — оновіть курс.', { date })
    : t('Комерційного курсу немає. Ціни продажу, борг у EUR, кошик, форми 40/41 та NBA рахуються за ним — внесіть курс.')

  return (
    <Tooltip label={details} multiline w={320} withArrow>
      <span className="rate-stale-warning" role="status" aria-label={details} tabIndex={0}>
        <TriangleAlert size={14} aria-hidden="true" />
        <span>{t('Курс застарів')}</span>
      </span>
    </Tooltip>
  )
}

function RateGroup({
  group,
  isSelected,
  onClick,
  buttonRef,
}: {
  group: ExchangeRateGroup
  isSelected: boolean
  onClick: () => void
  buttonRef: (el: HTMLButtonElement | null) => void
}) {
  const baseCurrency = group.id.endsWith('-uah') ? 'UAH' : group.id.endsWith('-pln') ? 'PLN' : null
  const source = group.id.startsWith('government-') ? group.title.split(' ')[0] : null
  const label = `${group.title}: ${group.rates.map((rate) => `${rate.Code} ${formatRate(rate.Amount)}`).join(', ')}`

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`rate-group-button${isSelected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-expanded={isSelected}
      aria-haspopup="dialog"
      aria-label={label}
      title={group.title}
    >
      {(baseCurrency || source) && (
        <span className="rate-group-label" aria-hidden="true">
          {source && <small>{source}</small>}
          {baseCurrency && <span>{baseCurrency}</span>}
        </span>
      )}
      {group.rates.map((rate) => (
        <RateValue key={getRateKey(rate)} rate={rate} />
      ))}
    </button>
  )
}

function RateValue({ rate }: { rate: ExchangeRate }) {
  return (
    <span className="rate-item">
      <span className="rate-item-code">{rate.Code.replace(/\s+TO\s+/gi, '/')}</span>
      <span className="rate-item-value">{formatRate(rate.Amount)}</span>
    </span>
  )
}
