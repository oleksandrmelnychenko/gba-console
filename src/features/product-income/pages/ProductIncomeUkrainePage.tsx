import { Stack, Title } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'
import { ProductIncomeDocumentsPage } from '../../product-income-documents/pages/ProductIncomeDocumentsPage'

export function ProductIncomeUkrainePage() {
  const { t } = useI18n()

  return (
    <Stack gap="md">
      <Title order={3}>{t('Прихід товару на Україні')}</Title>
      <ProductIncomeDocumentsPage />
    </Stack>
  )
}
