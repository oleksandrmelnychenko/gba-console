import { HoverCard, Skeleton } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { Image as ImageIcon, ZoomIn } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getProductMainImage, getProductShopImageUrl } from '../../../products/utils'
import type { WizardSaleProduct } from './wizardSaleProduct'
import './wizard-product-photo.css'

export function WizardProductPhoto({
  className,
  hoverPreview = true,
  onOpen,
  product,
}: {
  className: string
  hoverPreview?: boolean
  onOpen?: () => void
  product: WizardSaleProduct
}) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const [loadedUrls, setLoadedUrls] = useState<string[]>([])
  const imageUrl = [getProductMainImage(product)?.ImageUrl, getProductShopImageUrl(product)]
    .find((url) => url && !failedUrls.includes(url))
  const name = product.NameUA || product.Name || product.VendorCode || t('Без назви')
  const loading = Boolean(imageUrl && !loadedUrls.includes(imageUrl))
  const markLoaded = useCallback(() => {
    if (imageUrl) setLoadedUrls((urls) => urls.includes(imageUrl) ? urls : [...urls, imageUrl])
  }, [imageUrl])
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    // Cached images can already be complete when the element is attached.
    if (image?.complete && image.naturalWidth > 0) markLoaded()
  }, [markLoaded])

  if (!imageUrl) {
    return (
      <div className={`${className} wizard-product-photo`}>
        <ImageIcon aria-label={t('Фото відсутнє')} size={24} strokeWidth={1.5} />
      </div>
    )
  }

  const handleImageError = () => setFailedUrls((urls) => urls.includes(imageUrl) ? urls : [...urls, imageUrl])
  const photo = (
    <>
      <img
        ref={imageRef}
        alt={name}
        className={loading ? 'wizard-product-photo__image is-loading' : 'wizard-product-photo__image'}
        loading="lazy"
        src={imageUrl}
        onError={handleImageError}
        onLoad={markLoaded}
      />
      {loading && <Skeleton aria-hidden animate={!reduceMotion} className="wizard-product-photo__skeleton" radius={0} />}
    </>
  )

  const target = onOpen ? (
          <button
            aria-haspopup="dialog"
            aria-busy={loading}
            aria-label={`${t('Збільшити фото')} · ${name}`}
            className={`${className} wizard-product-photo is-interactive`}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
            onKeyDown={(event) => {
              // Photo activation must not reach the wizard's Enter-to-add shortcut.
              if ((event.key === 'Enter' || event.key === ' ') && !event.ctrlKey && !event.altKey && !event.metaKey) {
                event.preventDefault()
                event.stopPropagation()
                if (!event.repeat) onOpen()
              }
            }}
          >
            {photo}
            {!hoverPreview && <span aria-hidden className="wizard-product-photo__zoom"><ZoomIn size={18} /></span>}
          </button>
        ) : (
          <div aria-busy={loading} className={`${className} wizard-product-photo`}>{photo}</div>
        )

  if (!hoverPreview) return target

  return (
    <HoverCard openDelay={200} closeDelay={100} position="right-start" shadow="md" withinPortal>
      <HoverCard.Target>{target}</HoverCard.Target>
      <HoverCard.Dropdown className="wizard-product-photo-preview">
        <img alt={name} src={imageUrl} onError={handleImageError} />
      </HoverCard.Dropdown>
    </HoverCard>
  )
}
