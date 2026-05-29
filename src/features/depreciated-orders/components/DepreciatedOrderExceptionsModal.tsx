import { Alert, Button, Group, ScrollArea, Stack, Text, Tooltip } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { AppModal } from '../../../shared/ui/AppModal'
import { useI18n } from '../../../shared/i18n/useI18n'

export type DepreciatedOrderExceptionsModalProps = {
  exceptions: string[]
  onClose: () => void
}

export function DepreciatedOrderExceptionsModal({ exceptions, onClose }: DepreciatedOrderExceptionsModalProps) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={exceptions.length > 0}
      size="lg"
      title={t('Товари не потрапили в списання')}
      onClose={onClose}
    >
      <Stack gap="sm">
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} variant="light">
          {t('Частину товарів не вдалося списати.')}
        </Alert>
        <ScrollArea.Autosize mah={400} type="auto">
          <Stack gap="xs">
            {exceptions.map((exception, index) => (
              <Tooltip key={`${exception}-${index}`} label={exception} maw={420} withinPortal>
                <Text lineClamp={2} size="sm">
                  {exception}
                </Text>
              </Tooltip>
            ))}
          </Stack>
        </ScrollArea.Autosize>
        <Group justify="flex-end">
          <Button color="gray" variant="light" onClick={onClose}>
            {t('Закрити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
