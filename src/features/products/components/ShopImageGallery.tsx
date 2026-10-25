import { Group, Image } from '@mantine/core'
import { useEffect, useState } from 'react'
import { createShopGalleryLoader } from '../shopGalleryLoader'

const acquireGallery = createShopGalleryLoader()

type ShopImageGalleryProps = {
  vendorCode?: string | null
  onImageClick: (url: string) => void
}

export function ShopImageGallery({ vendorCode, onImageClick }: ShopImageGalleryProps) {
  const code = vendorCode?.trim().toLowerCase() || ''
  const [snapshot, setSnapshot] = useState<{ code: string; images: string[] } | null>(null)
  const images = snapshot?.code === code ? snapshot.images : []

  useEffect(() => {
    if (!code) return
    let active = true
    const gallery = acquireGallery(code)
    void gallery.promise.then(images => {
      if (active) setSnapshot({ code, images })
    }).catch(() => {
      if (active) setSnapshot({ code, images: [] })
    })
    return () => { active = false; gallery.release() }
  }, [code])

  if (images.length === 0) {
    return null
  }

  return (
    <Group gap={6} className="product-inline-thumbs">
      {images.map((url, index) => (
        <button type="button" className="product-inline-thumb" key={url} onClick={() => onImageClick(url)}>
          <Image loading="lazy" decoding="async" src={url} alt={`${index + 1}`} fit="cover" h="100%" w="100%" />
        </button>
      ))}
    </Group>
  )
}
