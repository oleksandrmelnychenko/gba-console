import { DocumentDetailLayout, DocumentDetailSummary, DocumentDetailSection, DocumentDetailRow } from '../../../shared/ui/document-detail/DocumentDetail'
import { TableChip } from '../../../shared/ui/TableChip'
import {
  Alert,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Textarea,
} from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { ActProvidingServiceDetailModel } from './useActProvidingServiceDetailModel'
import { AppDateInput } from '../../../shared/ui/AppDateInput'

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function ActProvidingServiceDetailBody({
  canEdit,
  model,
}: {
  canEdit: boolean
  model: ActProvidingServiceDetailModel
}) {
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
    <Stack gap={10}>
      {error && (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
          {error}
        </Alert>
      )}

      {displayModel ? (
        <DocumentDetailLayout variant="inventory" summary={
          <DocumentDetailSummary variant="inventory" eyebrow={t('Акт надання послуг')}
            title={displayValue(displayModel.number)}
            meta={<><span className="app-money">{formatDateTime(displayModel.date)}</span><TableChip value={displayModel.accountingMarker ? t('Бухгалтерський') : t('Управлінський')} /></>}
            metrics={<Group gap={6}><Text className="app-money">{formatMoney(displayModel.totalWithVat)}</Text><TableChip tone="source" value={displayModel.currency} /></Group>}
          />
        }>
          <DocumentDetailSection title={t('Реквізити')}>
            <DetailValue label={t('Номер')} mono value={displayModel.number} />
            <DetailValue tone="product" label={t('Організація')} value={displayModel.organization} />
            <DetailValue label={t('Постачальник послуг')} value={displayModel.serviceOrganization} />
            <DetailValue label={t('Договір')} value={displayModel.agreement} />
            <DetailValue tone="source" label={t('Валюта')} mono value={displayModel.currency} />
            <DetailValue label={t('Дата інвойсу')} mono value={formatDateTime(displayModel.invDate)} />
            <DetailValue label={t('Номер інвойсу')} mono value={displayModel.invNumber} />
            <DetailValue tone="warning" label={t('Відповідальний')} value={displayModel.actResponsible} />
            <DetailValue label={t('Послуга')} value={displayModel.name} />
            <DetailValue label={t('Сума')} mono value={formatMoney(displayModel.amount)} />
            <DetailValue label={t('ПДВ %')} mono value={formatPercent(displayModel.percentVat)} />
            <DetailValue label={t('ПДВ')} mono value={formatMoney(displayModel.amountVat)} />
            <DetailValue label={t('Разом з ПДВ')} mono value={formatMoney(displayModel.totalWithVat)} />
          </DocumentDetailSection>

          <DocumentDetailSection title={t('Редагування')} stacked>
            <Group align="start" gap={10}>
              <AppDateInput maw={230}
                disabled={!canEdit || isLoading || isSaving}
                label={t('Дата акта')}
                type="datetime-local"
                value={fromDate}
                onChange={(event) => updateFromDate(event.currentTarget.value)}
              />
              <Textarea
                w={400}
                maw="100%"
                autosize
                disabled={!canEdit || isLoading || isSaving}
                label={t('Коментар')}
                minRows={1}
                value={comment}
                onChange={(event) => updateComment(event.currentTarget.value)}
              />
            </Group>
          </DocumentDetailSection>
        </DocumentDetailLayout>
      ) : isLoading ? (
        <Card className="app-section-card" withBorder radius="md" padding={12}>
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        </Card>
      ) : (
        <Card className="app-section-card" withBorder radius="md" padding={12}>
          <Text c="dimmed">{t('Акт надання послуг не знайдено')}</Text>
        </Card>
      )}
    </Stack>
  )
}

function DetailValue({ label, mono = false, tone, value }: { label: string; mono?: boolean; tone?: 'product' | 'source' | 'warning' | 'neutral'; value?: string | number }) {
  return (
    <DocumentDetailRow label={label} mono={mono} value={tone ? <TableChip tone={tone} value={displayValue(value)} /> : displayValue(value)} />
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
