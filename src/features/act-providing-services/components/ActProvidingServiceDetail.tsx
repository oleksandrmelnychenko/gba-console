import {
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ActProvidingServiceDetailModel } from './useActProvidingServiceDetailModel'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function ActProvidingServiceDetailBody({ model }: { model: ActProvidingServiceDetailModel }) {
  const { t } = useI18n()
  const {
    comment,
    displayModel,
    error,
    fromDate,
    isLoading,
    isSaving,
    updateComment,
    updateFromDate,
  } = model

  return (
    <Stack gap="lg">
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {displayModel ? (
        <Card className="app-section-card" withBorder radius="md" padding="lg">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="sm">
              <Stack gap={4}>
                <Text fw={500} size="lg" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
                  {displayValue(displayModel.number)}
                </Text>
                <Text c="dimmed" size="sm" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 0 }}>
                  {formatDateTime(displayModel.date)}
                </Text>
              </Stack>
              <Badge className={displayModel.accountingMarker ? 'app-role-pill is-orange' : 'app-role-pill is-green'} size="lg" variant="light">
                {displayModel.accountingMarker ? t('Бухгалтерський') : t('Управлінський')}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm" verticalSpacing={10}>
              <DetailValue label={t('Номер')} mono value={displayModel.number} />
              <DetailValue label={t('Організація')} value={displayModel.organization} />
              <DetailValue label={t('Постачальник послуг')} value={displayModel.serviceOrganization} />
              <DetailValue label={t('Договір')} value={displayModel.agreement} />
              <DetailValue label={t('Валюта')} mono value={displayModel.currency} />
              <DetailValue label={t('Дата інвойсу')} mono value={formatDateTime(displayModel.invDate)} />
              <DetailValue label={t('Номер інвойсу')} mono value={displayModel.invNumber} />
              <DetailValue label={t('Відповідальний')} value={displayModel.actResponsible} />
              <DetailValue label={t('Послуга')} value={displayModel.name} />
              <DetailValue label={t('Сума')} mono value={formatMoney(displayModel.amount)} />
              <DetailValue label={t('ПДВ %')} mono value={formatPercent(displayModel.percentVat)} />
              <DetailValue label={t('ПДВ')} mono value={formatMoney(displayModel.amountVat)} />
              <DetailValue label={t('Разом з ПДВ')} mono value={formatMoney(displayModel.totalWithVat)} />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              <TextInput
                disabled={isLoading || isSaving}
                label={t('Дата акта')}
                type="datetime-local"
                value={fromDate}
                onChange={(event) => updateFromDate(event.currentTarget.value)}
              />
              <Textarea
                autosize
                disabled={isLoading || isSaving}
                label={t('Коментар')}
                minRows={2}
                value={comment}
                onChange={(event) => updateComment(event.currentTarget.value)}
              />
            </SimpleGrid>
          </Stack>
        </Card>
      ) : isLoading ? (
        <Card className="app-section-card" withBorder radius="md" padding="lg">
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        </Card>
      ) : (
        <Card className="app-section-card" withBorder radius="md" padding="lg">
          <Text c="dimmed">{t('Акт надання послуг не знайдено')}</Text>
        </Card>
      )}
    </Stack>
  )
}

function DetailValue({ label, mono = false, value }: { label: string; mono?: boolean; value?: string | number }) {
  return (
    <div className={`act-service-detail-field${mono ? ' is-mono' : ''}`}>
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  )
}

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return dateTimeFormatter.format(date)
}

function formatMoney(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }

  return moneyFormatter.format(value)
}

function formatPercent(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }

  return `${value}%`
}

function displayValue(value?: string | number | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }

  return value || ''
}
