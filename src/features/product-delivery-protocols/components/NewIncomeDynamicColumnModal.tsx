import { Button, Group, Stack, TextInput } from '@mantine/core'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'

type NewIncomeDynamicColumnModalProps = {
  disabled?: boolean
  opened: boolean
  onClose: () => void
  onAdd: (fromDate: string) => void
}

export function NewIncomeDynamicColumnModal({
  disabled = false,
  opened,
  onClose,
  onAdd,
}: NewIncomeDynamicColumnModalProps) {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState<string>(() => formatLocalDate(new Date()))

  return (
    <AppModal
      opened={opened}
      title={t('Додати нову колонку')}
      onClose={() => {
        if (!disabled) {
          onClose()
        }
      }}
    >
      <Stack gap="md">
        <TextInput
          disabled={disabled}
          label={t('Від якої дати')}
          type="date"
          value={fromDate}
          onChange={(event) => {
            if (!disabled) {
              setFromDate(event.currentTarget.value)
            }
          }}
        />
        <Group justify="flex-end">
          <Button color="gray" disabled={disabled} variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button disabled={disabled || !fromDate} onClick={() => onAdd(fromDate)}>
            {t('Додати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
