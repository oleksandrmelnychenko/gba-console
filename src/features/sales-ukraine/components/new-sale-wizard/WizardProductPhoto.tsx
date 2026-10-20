import { HoverCard, Skeleton } from '@mantine/core'
import { useReducedMotion } from '@mantine/hooks'
import { Image as ImageIcon, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getProductMainImage, getProductShopImageUrl } from '../../../products/utils'
import type { WizardSaleProduct } from './wizardSaleProduct'
import './wizard-product-photo.css'

// Related rows unmount while moving between products. Keep successful loads
// across those mounts so browser-cached photos do not flash a loading mask.
const loadedPhotoUrls = new Set<string>()
const MAX_CACHED_PHOTOS = 256

function rememberLoadedPhoto(url: string) {
  loadedPhotoUrls.delete(url)
  loadedPhotoUrls.add(url)
  if (loadedPhotoUrls.size > MAX_CACHED_PHOTOS) {
    const oldest = loadedPhotoUrls.values().next().value
    if (oldest) loadedPhotoUrls.delete(oldest)
  }
}

function DelayedPhotoSkeleton({ animate }: { animate: boolean }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180)
    return () => window.clearTimeout(timer)
  }, [])
  return visible ? <Skeleton aria-hidden animate={animate} className="wizard-product-photo__skeleton" radius={0} /> : null
}

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
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const imageUrl = [getProductMainImage(product)?.ImageUrl, getProductShopImageUrl(product)]
    .find((url) => url && !failedUrls.includes(url))
  const name = product.NameUA || product.Name || product.VendorCode || t('Без назви')
  const loading = Boolean(imageUrl && imageUrl !== loadedUrl && !loadedPhotoUrls.has(imageUrl))
  const markLoaded = useCallback((image: HTMLImageElement) => {
    if (!imageUrl || !image.complete || image.naturalWidth === 0) return
    // A reused element may still report the previous resource as complete.
    // Only record the resource actually selected by the browser.
    const expectedSrc = new URL(imageUrl, image.ownerDocument.baseURI).href
    if ((image.currentSrc || image.src) !== expectedSrc) return
    rememberLoadedPhoto(imageUrl)
    setLoadedUrl(imageUrl)
  }, [imageUrl])
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    // Cached images can already be complete when the element is attached.
    if (image) markLoaded(image)
  }, [markLoaded])

  if (!imageUrl) {
    return (
      <div className={`${className} wizard-product-photo`}>
        <ImageIcon aria-label={t('Фото відсутнє')} size={24} strokeWidth={1.5} />
      </div>
    )
  }

  const handleImageError = () => {
    loadedPhotoUrls.delete(imageUrl)
    setFailedUrls((urls) => urls.includes(imageUrl) ? urls : [...urls, imageUrl])
  }
  const photo = (
    <>
      <img
        key={`image:${imageUrl}`}
        ref={imageRef}
        alt={name}
        className={loading ? 'wizard-product-photo__image is-loading' : 'wizard-product-photo__image'}
        loading="lazy"
        src={imageUrl}
        onError={handleImageError}
        onLoad={(event) => markLoaded(event.currentTarget)}
      />
      {loading && <DelayedPhotoSkeleton key={`loading:${imageUrl}`} animate={!reduceMotion} />}
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
