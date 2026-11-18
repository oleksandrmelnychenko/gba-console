import { Button, Stack, Text } from '@mantine/core'
import { useI18n } from '../i18n/useI18n'
import { AppModal, AppModalFooter } from '../ui/AppModal'
import { ZERO_PRICE_CONFIRM_MESSAGE } from './zeroPriceConfirm'

export type ZeroPriceConfirmModalProps = {
  opened: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** «Ціна 0 — товар буде оприбутковано безкоштовно. Продовжити?» before posting a free-goods income. */
export function ZeroPriceConfirmModal({ opened, onCancel, onConfirm }: ZeroPriceConfirmModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={opened} title={t('Ціна 0')} onClose={onCancel}>
      <Stack className="app-compact-form" gap="md">
        <Text size="sm">{t(ZERO_PRICE_CONFIRM_MESSAGE)}</Text>
        <AppModalFooter>
          <Button color="gray" variant="default" onClick={onCancel}>
            {t('Скасувати')}
          </Button>
          <Button data-autofocus onClick={onConfirm}>
            {t('Продовжити')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
