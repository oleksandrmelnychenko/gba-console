import { Alert, Button, Group, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { TaxFreeCarrierCar } from '../types'

type CarDraft = {
  number: string
  volume: string
}

const EMPTY_DRAFT: CarDraft = {
  number: '',
  volume: '',
}

export function TaxFreeCarrierCarModal({
  opened,
  onClose,
  onSubmit,
}: {
  opened: boolean
  onClose: () => void
  onSubmit: (car: TaxFreeCarrierCar) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useValueState<CarDraft>(EMPTY_DRAFT)
  const [error, setError] = useValueState<string | null>(null)

  function resetDraft() {
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  function handleSubmit() {
    if (!draft.number.trim()) {
      setError(t('Вкажіть номер машини'))
      return
    }

    onSubmit({
      Number: draft.number.trim(),
      Volume: parseVolume(draft.volume),
    })
  }

  return (
    <AppModal
      centered
      opened={opened}
      title={t('Машина перевізника')}
      transitionProps={{ onEnter: resetDraft }}
      onClose={onClose}
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={t('Номер')}
            required
            value={draft.number}
            onChange={(event) => setDraft((current) => ({ ...current, number: event.currentTarget.value }))}
          />
          <TextInput
            inputMode="decimal"
            label={t("Об'єм")}
            value={draft.volume}
            onChange={(event) => setDraft((current) => ({ ...current, volume: event.currentTarget.value }))}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button color="gray" variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="violet" onClick={handleSubmit}>
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function parseVolume(value: string): number {
  const normalized = value.replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}
