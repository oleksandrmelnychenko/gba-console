import { Image } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'

export function ProductImageViewModal({
  fallbackSrc,
  imageName,
  imageUrl,
  onClose,
  onEditCart,
}: {
  fallbackSrc?: string
  imageName?: string
  imageUrl: string | null
  onClose: () => void
  onEditCart?: () => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      className="new-sale-product-image-modal"
      closeButtonProps={{ 'aria-label': t('Закрити фото') }}
      closeOnEscape={false}
      opened={Boolean(imageUrl)}
      size="xl"
      title={t('Перегляд зображення')}
      onClose={onClose}
      onKeyDown={(event) => {
        // This portal belongs to the wizard, but its keys must not reach the wizard beneath it.
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        } else if (event.key === 'F2' && onEditCart) {
          event.preventDefault()
          onEditCart()
        }
      }}
    >
      {imageUrl && <Image alt={imageName || t('Перегляд зображення')} fallbackSrc={fallbackSrc} fit="contain" mah="70vh" src={imageUrl} />}
    </AppModal>
  )
}
