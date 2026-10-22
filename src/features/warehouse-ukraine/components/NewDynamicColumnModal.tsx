import { Button, Stack } from '@mantine/core'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { AppDateInput } from '../../../shared/ui/AppDateInput'

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
      <Stack className="app-compact-form" gap="md">
        <AppDateInput
          disabled={disabled}
          label={t('Від якої дати')}
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.currentTarget.value)}
        />
        <AppModalFooter>
          <Button color="gray" disabled={disabled} variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button disabled={disabled || !fromDate} onClick={() => onAdd(fromDate)}>
            {t('Додати')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
