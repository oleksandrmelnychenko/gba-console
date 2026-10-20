import { Alert, Button, ScrollArea, Stack, Text, Tooltip } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
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
      <Stack className="app-compact-form" gap="sm">
        <Alert color="yellow" icon={<TriangleAlert size={18} />} variant="light">
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
        <AppModalFooter>
          <Button color="gray" variant="default" onClick={onClose}>
            {t('Закрити')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )
}
