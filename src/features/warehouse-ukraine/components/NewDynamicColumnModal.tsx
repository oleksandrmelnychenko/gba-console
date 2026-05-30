import { Button, Group, Stack, TextInput } from '@mantine/core'
import { formatLocalDate } from '../../../shared/date/dateTime'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'

type NewDynamicColumnModalProps = {
  opened: boolean
  onClose: () => void
  onAdd: (fromDate: string) => void
}

export function NewDynamicColumnModal({ opened, onClose, onAdd }: NewDynamicColumnModalProps) {
  const { t } = useI18n()
  const [fromDate, setFromDate] = useValueState<string>(() => formatLocalDate(new Date()))
  const [syncedOpened, setSyncedOpened] = useValueState(false)

  if (opened !== syncedOpened) {
    setSyncedOpened(opened)

    if (opened) {
      setFromDate(formatLocalDate(new Date()))
    }
  }

  return (
    <AppModal opened={opened} title={t('Нова колонка')} onClose={onClose}>
      <Stack gap="md">
        <TextInput
          label={t('Від якої дати')}
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button color="gray" variant="light" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button disabled={!fromDate} onClick={() => onAdd(fromDate)}>
            {t('Додати')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
