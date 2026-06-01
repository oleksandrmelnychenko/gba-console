import { Button, Group, Stack, TextInput } from '@mantine/core'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'

type NewDynamicColumnModalProps = {
  opened: boolean
  disabled?: boolean
  onClose: () => void
  onAdd: (fromDate: string) => void
}

export function NewDynamicColumnModal({ disabled = false, opened, onClose, onAdd }: NewDynamicColumnModalProps) {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState<string>(() => formatLocalDate(new Date()))

  return (
    <AppModal
      opened={opened}
      title={t('Нова колонка')}
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
          onChange={(event) => setFromDate(event.currentTarget.value)}
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
