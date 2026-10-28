import { Button, Group, SegmentedControl, Text } from '@mantine/core'
import { ChevronUp, LayoutList, ShoppingCart, Table2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppBottomSheet } from '../../../../shared/ui/AppBottomSheet'
import { TableChip } from '../../../../shared/ui/TableChip'
import { roundMoney } from '../../saleMoney'
import type { SalesUkraineOrderItem } from '../../types'
import { getWizardCartTotals } from './wizardCartTotals'
import { WizardShoppingCartGrid } from './WizardShoppingCartGrid'
import { WizardCartCards } from './WizardCartCards'
import { useWizardCartPricing } from './useWizardCartPricing'
import './wizard-cart-sheet.css'

const amountFormatter = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qtyFormatter = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

export function WizardCartSheet({
  agreementNetId,
  busy,
  items,
  localCurrencyCode,
  opened,
  overlayActive = false,
  totalVat,
  useEurToUah,
  onClose,
  onCrossSell,
  onEditCart,
  onOpen,
  onRemove,
  onRowClick,
}: {
  agreementNetId?: string | null
  busy: boolean
  items: SalesUkraineOrderItem[]
  localCurrencyCode: string
  opened: boolean
  overlayActive?: boolean
  totalVat?: number
  useEurToUah: boolean
  onClose: () => void
  onCrossSell?: (item: SalesUkraineOrderItem) => void
  onEditCart: () => void
  onOpen: () => void
  onRemove?: (item: SalesUkraineOrderItem) => void
  onRowClick: (item: SalesUkraineOrderItem) => void
}) {
  const { t } = useI18n()
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null)
  const [view, setView] = useState('cards')
  const { prices, retry } = useWizardCartPricing(items, agreementNetId, opened && view === 'cards')
  const lastCartFocusRef = useRef<HTMLElement | null>(null)
  const cartOpenerRef = useRef<HTMLElement | null>(null)
  const wasOpenedRef = useRef(opened)
  const overlayWasActiveRef = useRef(overlayActive)
  const totals = useMemo(() => getWizardCartTotals(items, useEurToUah), [items, useEurToUah])

  useEffect(() => {
    const wasOpened = wasOpenedRef.current
    wasOpenedRef.current = opened
    if (opened && !wasOpened) {
      cartOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      return
    }
    if (opened || !wasOpened) return
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement
      if (active === document.body || active instanceof HTMLElement && active.closest('.wizard-cart-sheet')) {
        if (cartOpenerRef.current?.isConnected) cartOpenerRef.current.focus({ preventScroll: true })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [opened])

  useEffect(() => {
    const shouldRestore = opened && overlayWasActiveRef.current && !overlayActive
    overlayWasActiveRef.current = overlayActive
    if (!shouldRestore) return
    const target = lastCartFocusRef.current
    const frame = window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [opened, overlayActive])

  return (
    <div
      className="wizard-cart-sheet-slot"
      onFocusCapture={(event) => {
        if (!overlayActive && event.target instanceof HTMLElement && event.target.closest('.wizard-cart-sheet')) {
          lastCartFocusRef.current = event.target
        }
      }}
      onKeyDown={(event) => {
        if (!opened || overlayActive) return
        event.stopPropagation()
        if (event.key === 'Escape' || event.key === 'F3') {
          event.preventDefault()
          if (event.key !== 'F3' || !event.repeat) onClose()
        } else if (event.key === 'F2') {
          event.preventDefault()
          onClose()
          onEditCart()
        }
      }}
    >
      <div className="wizard-cart-sheet-summary app-table-chips">
        <Group gap={8} wrap="nowrap">
          <ShoppingCart aria-hidden size={18} />
          <Text fw={600} size="sm">{t('Кошик')}</Text>
          <TableChip value={items.length} />
        </Group>
        <div className="wizard-cart-sheet-summary__totals">
          <span className="wizard-cart-sheet-summary__quantity">
            {t('К-сть')}: <strong className="app-money">{qtyFormatter.format(totals.quantity)}</strong>
          </span>
          <span><strong className="app-money">{amountFormatter.format(totals.eur)}</strong><TableChip tone="source" value="EUR" /></span>
          <span><strong className="app-money">{amountFormatter.format(totals.local)}</strong><TableChip tone="source" value={localCurrencyCode} /></span>
        </div>
        <Button
          aria-expanded={opened}
          aria-haspopup="dialog"
          leftSection={<ChevronUp size={16} />}
          size="sm"
          variant="default"
          onClick={onOpen}
        >
          {t('Показати кошик')}
        </Button>
      </div>
      <AppBottomSheet
        bodyClassName="wizard-cart-sheet__body"
        closeLabel={t('Закрити кошик')}
        closeOnEscape={false}
        collapseLabel={t('Згорнути кошик')}
        contentClassName="wizard-cart-sheet"
        expandLabel={t('Розгорнути кошик')}
        headerTools={
          <SegmentedControl
            aria-label={t('Вигляд кошика')}
            className="wizard-cart-sheet__view"
            color="orange"
            data={[
              { value: 'cards', label: <Group gap={6} wrap="nowrap"><LayoutList size={16} /><span>{t('Картки')}</span></Group> },
              { value: 'table', label: <Group gap={6} wrap="nowrap"><Table2 size={16} /><span>{t('Таблиця')}</span></Group> },
            ]}
            size="xs"
            value={view}
            onChange={setView}
          />
        }
        mediumHeightRatio={0.72}
        opened={opened}
        returnFocus={false}
        trapFocus={!overlayActive}
        zIndex={210}
        title={<Group gap={8}><ShoppingCart aria-hidden size={18} /><span>{t('Кошик')}</span><TableChip value={items.length} /></Group>}
        onClose={onClose}
      >
        <div className="wizard-cart-sheet__content">
          <div ref={setToolbarTarget} className="wizard-cart-sheet__tools" />
          {view === 'cards' ? (
            <>
              <WizardCartCards
                agreementNetId={agreementNetId}
                busy={busy}
                items={items}
                localCurrencyCode={localCurrencyCode}
                prices={prices}
                onRetryPricing={retry}
                useEurToUah={useEurToUah}
                onCrossSell={onCrossSell}
                onRemove={onRemove}
                onRowClick={onRowClick}
              />
              <div className="wizard-cart-sheet__footer app-table-chips">
                <span className="wizard-cart-sheet__footer-label">{t('Разом')}</span>
                <div><span>{t('К-сть')}</span><strong className="app-money">{qtyFormatter.format(totals.quantity)}</strong></div>
                <div><TableChip tone="source" value="EUR" /><strong className="app-money">{amountFormatter.format(totals.eur)}</strong></div>
                <div><TableChip tone="source" value={localCurrencyCode} /><strong className="app-money">{amountFormatter.format(totals.local)}</strong></div>
              </div>
            </>
          ) : <WizardShoppingCartGrid
            totals={totals}
            busy={busy}
            items={items}
            localCurrencyCode={localCurrencyCode}
            toolbarPortalTarget={toolbarTarget}
            useEurToUah={useEurToUah}
            onCrossSell={onCrossSell}
            onRemove={onRemove}
            onRowClick={onRowClick}
          />}
          {totalVat != null && items.length > 0 && (
            <Text className="wizard-cart-sheet__vat" size="sm">
              {t('ПДВ')}: <span className="app-money">{amountFormatter.format(roundMoney(totalVat))}</span>
            </Text>
          )}
        </div>
      </AppBottomSheet>
    </div>
  )
}
