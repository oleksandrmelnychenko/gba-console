import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProductImage } from './types'

type Preview = { file: File; url: string }
const EMPTY_IMAGES: ProductImage[] = []

function imageKey(image: ProductImage) {
  if (image.NetUid) return `net:${image.NetUid}`
  if (typeof image.Id === 'number') return `id:${image.Id}`
  return image.FileName || image.ImageUrl ? `file:${image.FileName || ''}:${image.ImageUrl || ''}` : ''
}

export function useProductImageDraft(originalImages: ProductImage[] = EMPTY_IMAGES) {
  const [images, setImages] = useState(() => [...originalImages])
  const [filePreviews, setFilePreviews] = useState<Preview[]>([])
  const previewsRef = useRef<Preview[]>([])
  const files = useMemo(() => filePreviews.map(preview => preview.file), [filePreviews])
  const hasExistingImageChanges = images.length !== originalImages.length || images.some((image, index) => (
    Boolean(image.IsMainImage) !== Boolean(originalImages[index]?.IsMainImage)
    || Boolean(image.Deleted) !== Boolean(originalImages[index]?.Deleted)
  ))
  const displayedImages = useMemo(() => images.reduce<Array<{ image: ProductImage; index: number }>>((visible, image, index) => {
    if (!image.Deleted || !originalImages[index]?.Deleted) visible.push({ image, index })
    return visible
  }, []), [images, originalImages])

  useEffect(() => () => {
    previewsRef.current.forEach(preview => URL.revokeObjectURL(preview.url))
    previewsRef.current = []
  }, [])

  const updateSelectedFiles = useCallback((nextFiles: File[]) => {
    const previous = previewsRef.current
    const byFile = new Map(previous.map(preview => [preview.file, preview]))
    const next = nextFiles.map(file => byFile.get(file) ?? { file, url: URL.createObjectURL(file) })
    const retained = new Set(next.map(preview => preview.url))
    previous.forEach(preview => { if (!retained.has(preview.url)) URL.revokeObjectURL(preview.url) })
    previewsRef.current = next
    setFilePreviews(next)
  }, [])

  const makeMain = useCallback((image: ProductImage) => {
    const key = imageKey(image)
    setImages(current => current.map(item => {
      const isMain = key ? imageKey(item) === key : item === image
      return Boolean(item.IsMainImage) === isMain ? item : { ...item, IsMainImage: isMain }
    }))
  }, [])
  const removeImage = useCallback((image: ProductImage) => {
    const key = imageKey(image)
    setImages(current => current.map(item => (key ? imageKey(item) === key : item === image) && !item.Deleted ? { ...item, Deleted: true } : item))
  }, [])
  const reset = () => { setImages([...originalImages]); updateSelectedFiles([]) }
  return { images, setImages, files, filePreviews, displayedImages, hasExistingImageChanges,
    hasChanges: files.length > 0 || hasExistingImageChanges, makeMain, removeImage, updateSelectedFiles, reset }
}
