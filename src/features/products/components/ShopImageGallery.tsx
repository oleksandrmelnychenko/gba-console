import { Group, Image } from '@mantine/core'
import { useEffect, useState } from 'react'
import { getProductShopGalleryImageUrl } from '../utils'

const MAX_SHOP_GALLERY_PROBES = 30
const SHOP_GALLERY_PROBE_BATCH_SIZE = 4
const shopGalleryCache = new Map<string, Promise<string[]>>()

type ShopImageGalleryProps = {
  vendorCode?: string | null
  onImageClick: (url: string) => void
}

function probeImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new window.Image()
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = url
  })
}

async function discoverShopGalleryImages(vendorCode: string): Promise<string[]> {
  const found: string[] = []

  // Gallery files are numbered contiguously. Probe a small batch at a time and
  // stop at the first missing suffix instead of downloading all 30 candidates.
  for (let start = 1; start <= MAX_SHOP_GALLERY_PROBES; start += SHOP_GALLERY_PROBE_BATCH_SIZE) {
    const probeUrls = Array.from(
      { length: Math.min(SHOP_GALLERY_PROBE_BATCH_SIZE, MAX_SHOP_GALLERY_PROBES - start + 1) },
      (_unused, index) => getProductShopGalleryImageUrl(vendorCode, start + index),
    )
    const probeResults = await Promise.all(probeUrls.map((url) => probeImage(url)))
    const firstMissingIndex = probeResults.findIndex((exists) => !exists)

    found.push(...probeUrls.slice(0, firstMissingIndex === -1 ? probeUrls.length : firstMissingIndex))

    if (firstMissingIndex !== -1) {
      break
    }
  }

  return found
}

function getCachedShopGalleryImages(vendorCode: string): Promise<string[]> {
  const cacheKey = vendorCode.trim().toLowerCase()
  const cached = shopGalleryCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const request = discoverShopGalleryImages(cacheKey)
  shopGalleryCache.set(cacheKey, request)

  return request
}

export function ShopImageGallery({ vendorCode, onImageClick }: ShopImageGalleryProps) {
  const [images, setImages] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const code = vendorCode?.trim()

    async function loadGallery() {
      setImages([])

      if (!code) {
        return
      }

      const found = await getCachedShopGalleryImages(code)

      if (cancelled) {
        return
      }

      setImages(found)
    }

    void loadGallery()

    return () => {
      cancelled = true
    }
  }, [vendorCode])

  if (images.length === 0) {
    return null
  }

  return (
    <Group gap={6} className="product-inline-thumbs">
      {images.map((url, index) => (
        <button type="button" className="product-inline-thumb" key={url} onClick={() => onImageClick(url)}>
          <Image src={url} alt={`${index + 1}`} fit="cover" h="100%" w="100%" />
        </button>
      ))}
    </Group>
  )
}
