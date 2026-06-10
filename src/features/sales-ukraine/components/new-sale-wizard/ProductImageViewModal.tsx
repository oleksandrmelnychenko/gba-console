import { Image } from '@mantine/core'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { AppModal } from '../../../../shared/ui/AppModal'

export function ProductImageViewModal({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void }) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(imageUrl)} size="xl" title={t('Перегляд зображення')} onClose={onClose}>
      {imageUrl && <Image alt={t('Перегляд зображення')} fit="contain" mah="70vh" src={imageUrl} />}
    </AppModal>
  )
}
