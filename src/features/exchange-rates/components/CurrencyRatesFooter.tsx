import { Badge, Group, Loader, Text } from '@mantine/core'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useExchangeRates } from '../hooks/useExchangeRates'
import type { ExchangeRate, ExchangeRateGroup } from '../types'
import { buildExchangeRateGroups, formatRate, getRateKey } from '../utils'
import { CurrencyRatesPanel } from './CurrencyRatesPanel'

const PANEL_WIDTH = 430
const PANEL_GAP = 10

export function CurrencyRatesFooter() {
  const { data, error, isLoading, refresh } = useExchangeRates()
  const { t } = useI18n()
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
      if (selectedGroupId === group.id) {
        setSelectedGroupId(null)
        setPanelStyle(null)
        return
      }
      setPanelStyle(computePanelStyle(group.id))
      setSelectedGroupId(group.id)
    },
    [computePanelStyle, selectedGroupId],
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
      <Group gap="xs" wrap="nowrap">
        <Loader size="xs" color="orange" />
        <Text size="xs" c="dimmed">
          {t('Завантаження')}
        </Text>
      </Group>
    )
  }

  if (error) {
    return (
      <Text size="xs" c="red">
        {t('Курси недоступні')}
      </Text>
    )
  }

  if (!data || groups.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        {t('Немає даних')}
      </Text>
    )
  }

  return (
    <>
      <Group gap="xs" wrap="nowrap" className="rates-footer-groups">
        {groups.map((group) => (
          <RateGroup
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
            onClick={() => toggleGroup(group)}
            buttonRef={(el) => {
              if (el) buttonRefs.set(group.id, el)
              else buttonRefs.delete(group.id)
            }}
          />
        ))}
      </Group>
      {selectedGroup && (
        <CurrencyRatesPanel
          key={selectedGroup.id}
          group={selectedGroup}
          onClose={() => setSelectedGroupId(null)}
          onRefresh={refresh}
          style={panelStyle}
        />
      )}
    </>
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
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`rate-group-button${isSelected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
    >
      <Badge className="rate-group-badge app-role-pill" variant={isSelected ? 'filled' : 'light'} size="xs" radius="xl">
        {group.title}
      </Badge>
      {group.rates.map((rate) => (
        <RateValue key={getRateKey(rate)} rate={rate} />
      ))}
    </button>
  )
}

function RateValue({ rate }: { rate: ExchangeRate }) {
  return (
    <span className="rate-item">
      <span className="rate-item-code">{rate.Code}</span>
      <span className="rate-item-value">{formatRate(rate.Amount)}</span>
    </span>
  )
}
