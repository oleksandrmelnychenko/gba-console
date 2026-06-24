import { Card, SimpleGrid, Stack, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PriceHintPanel } from '../components/PriceHintPanel'

export function PricingPage() {
  const { t } = useI18n()
  const [productNetId, setProductNetId] = useState('')
  const [clientAgreementNetId, setClientAgreementNetId] = useState('')

  return (
    <Stack gap="md">
      <Title order={3}>{t('Рекомендація ціни')}</Title>
      <Card className="app-section-card" padding="md" radius="md" withBorder>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput
              label={t('Товар (NetUID)')}
              onChange={(event) => setProductNetId(event.currentTarget.value.trim())}
              value={productNetId}
            />
            <TextInput
              label={t('Угода клієнта (NetUID)')}
              onChange={(event) => setClientAgreementNetId(event.currentTarget.value.trim())}
              value={clientAgreementNetId}
            />
          </SimpleGrid>
          <PriceHintPanel clientAgreementNetId={clientAgreementNetId} productNetId={productNetId} />
        </Stack>
      </Card>
    </Stack>
  )
}
