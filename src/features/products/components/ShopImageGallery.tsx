import { Group, Image } from '@mantine/core'
import { useEffect, useState } from 'react'
import { getProductShopGalleryImageUrl } from '../utils'

const MAX_SHOP_GALLERY_PROBES = 30

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

      const found: string[] = []

      for (let suffix = 1; suffix <= MAX_SHOP_GALLERY_PROBES; suffix += 1) {
        const url = getProductShopGalleryImageUrl(code, suffix)
        const exists = await probeImage(url)

        if (cancelled) {
          return
        }

        if (!exists) {
          break
        }

        found.push(url)
      }

      if (!cancelled) {
        setImages(found)
      }
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
