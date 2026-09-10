import { Stack, Text, Title } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ReportsStocksPage } from './ReportsStocksPage'

export function ReportsConstructorPage() {
  const { t } = useI18n()

  return (
    <Stack gap="sm">
      <div>
        <Title order={2}>{t('Конструктор звітів')}</Title>
        <Text size="sm" c="dimmed">
          {t('Оберіть набір даних, налаштуйте показники, групування та фільтри, а потім сформуйте звіт.')}
        </Text>
      </div>
      <ReportsStocksPage />
    </Stack>
  )
}
