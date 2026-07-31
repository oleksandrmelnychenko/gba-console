import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import { toProxiedAssetUrl } from '../../../shared/url/proxiedAssetUrl'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { getProductShopImageUrlByCode } from '../../products/utils'
type ProcurementProductCellProps = {
  row: {
    image_url?: string | null
    oe_number?: string | null
    product_id: number
    product_name?: string | null
    vendor_code?: string | null
  }
  t: (key: string) => string
}

export function ProcurementProductCell({ row, t }: ProcurementProductCellProps) {
  const productName = row.product_name || row.vendor_code || String(row.product_id)
  const showVendorCode = Boolean(row.vendor_code && row.vendor_code !== productName)
  const explicitImageSrc = upgradeHttpToHttps(toProxiedAssetUrl(row.image_url?.trim()))
  const shopImageSrc = getProductShopImageUrlByCode(row.vendor_code)
  const imageCandidates = [explicitImageSrc, shopImageSrc].filter(
    (candidate, index, candidates) => candidate && candidates.indexOf(candidate) === index,
  )
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const imageSrc = imageCandidates.find((candidate) => !failedSources.has(candidate)) ?? ''
  const canShowImage = Boolean(imageSrc)

  return (
    <div className="procure-cockpit-product">
      <span
        aria-label={!canShowImage ? t('Зображення товару відсутнє') : undefined}
        className={`procure-cockpit-product__thumb${canShowImage ? ' has-image' : ' is-empty'}`}
        role={!canShowImage ? 'img' : undefined}
      >
        {canShowImage ? (
          <img
            alt=""
            aria-hidden="true"
            decoding="async"
            loading="lazy"
            src={imageSrc}
            onError={() => {
              setFailedSources((current) => {
                const next = new Set(current)
                next.add(imageSrc)
                return next
              })
            }}
          />
        ) : (
          <ImageOff aria-hidden="true" size={20} strokeWidth={1.7} />
        )}
      </span>

      <span className="procure-cockpit-product__identity">
        <span className="procure-cockpit-product__name" title={productName}>
          {productName}
        </span>
        {(showVendorCode || row.oe_number) && (
          <span className="procure-cockpit-product__meta">
            {showVendorCode && (
              <span className="procure-cockpit-product__code">{row.vendor_code}</span>
            )}
            {row.oe_number && (
              <span
                className="procure-cockpit-product__oe"
                title={`${t('Оригінальний номер')}: ${row.oe_number}`}
              >
                <span className="procure-cockpit-product__oe-label">OE</span>
                <span className="procure-cockpit-product__oe-value">{row.oe_number}</span>
              </span>
            )}
          </span>
        )}
      </span>
    </div>
  )
}
