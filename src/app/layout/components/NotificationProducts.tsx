import { useEffect, useRef, useState } from 'react'
import { Skeleton, Text } from '@mantine/core'
import { getSalesUkraineSaleDetails } from '../../../features/sales-ukraine/api/salesUkraineApi'
import type { SalesUkraineSale } from '../../../features/sales-ukraine/types'
import { WizardProductPhoto } from '../../../features/sales-ukraine/components/new-sale-wizard/WizardProductPhoto'
import type { WizardSaleProduct } from '../../../features/sales-ukraine/components/new-sale-wizard/wizardSaleProduct'
import { getProductMainOriginalNumber } from '../../../features/products/utils'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'

const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quantity = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })

/** Load legacy notifications too; only fetch cards entering the popover viewport. */
export function NotificationProducts({ saleNetUid }: { saleNetUid: string }) {
  const { t } = useI18n()
  const root = useRef<HTMLDivElement>(null)
  const [sale, setSale] = useState<SalesUkraineSale | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      void getSalesUkraineSaleDetails(saleNetUid, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setSale(result)
        setState('ready')
      }).catch(() => {
        if (!controller.signal.aborted) setState('error')
      })
    }, { rootMargin: '80px' })
    if (root.current) observer.observe(root.current)
    return () => {
      observer.disconnect()
      controller.abort()
    }
  }, [saleNetUid])

  const currency = sale?.ClientAgreement?.Agreement?.Currency?.Code
  const items = sale?.Order?.OrderItems || []
  return (
    <div ref={root} className="console-notification-products" aria-busy={state === 'loading'}>
      {state === 'loading' ? <Skeleton height={80} radius={10} /> : null}
      {state === 'error' ? <Text size="xs" c="dimmed">{t('Не вдалося завантажити товари')}</Text> : null}
      {state === 'ready' && !items.length ? <Text size="xs" c="dimmed">{t('Товарів не знайдено')}</Text> : null}
      {items.map((item, index) => {
        const product = item.Product as WizardSaleProduct | undefined
        const qty = item.Qty
        const total = item.TotalAmountLocal
        const unitPrice = typeof qty === 'number' && qty > 0 && typeof total === 'number' && Number.isFinite(total)
          ? total / qty : null
        const oem = product ? getProductMainOriginalNumber(product) : null
        return (
          <div className="console-notification-product" key={item.NetUid || item.Id || index}>
            <WizardProductPhoto className="console-notification-product-photo" hoverPreview={false} product={product || {}} />
            <div className="console-notification-product-copy">
              <span className="console-notification-product-code">{product?.VendorCode || product?.Articul}</span>
              <strong className="console-notification-product-name">{product?.NameUA || product?.Name || t('Без назви')}</strong>
              {oem ? <span className="console-notification-product-oem">OEM: <TableChip tone="warning" value={oem} /></span> : null}
              <div className="console-notification-product-price">
                {typeof qty === 'number' && Number.isFinite(qty) ? <TableChip tone="document" value={`${quantity.format(qty)} ${product?.MeasureUnit?.Name || t('шт')}`} /> : null}
                {unitPrice != null ? <><span aria-hidden>×</span><strong>{money.format(unitPrice)} {currency}</strong></> : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
