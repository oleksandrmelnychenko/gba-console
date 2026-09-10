import { Alert, Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useId } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { formatDateTime } from '../utils'

export type ReportDraftRecoveryPanelProps = {
  savedAt?: string | null
  loading?: boolean
  error?: string | null
  canRestore: boolean
  onRestore: () => void
  onDiscard: () => void
  onRetry?: () => void
}

export type ReportDraftStatusProps = {
  savedAt?: string | null
  notice?: string | null
  canUndo: boolean
  disabled?: boolean
  onUndo: () => void
}

const actionStyles = {
  root: { height: 'auto', minHeight: 36, maxWidth: '100%', paddingBlock: 8 },
  label: { whiteSpace: 'normal' as const },
}

function savedTime(savedAt?: string | null): string | null {
  return savedAt && !Number.isNaN(Date.parse(savedAt)) ? formatDateTime(savedAt) : null
}

export function ReportDraftRecoveryPanel({ savedAt, loading = false, error, canRestore,
  onRestore, onDiscard, onRetry }: ReportDraftRecoveryPanelProps) {
  const { t } = useI18n()
  const titleId = useId()
  const timestamp = savedTime(savedAt)

  return (
    <Paper component="section" withBorder radius="md" p="md" aria-labelledby={titleId} aria-busy={loading}>
      <Stack gap="sm">
        <Title id={titleId} order={3}>{t('Незбережена чернетка')}</Title>
        <Text size="sm">
          {t('У цій вкладці залишилися налаштування звіту. Відновіть їх, щоб продовжити роботу.')}
        </Text>
        <Text size="sm" c="dimmed">
          {t('Відновлення поверне лише налаштування. Щоб отримати звіт, натисніть «Сформувати».')}
        </Text>
        {timestamp ? <Text size="xs" c="dimmed">
          {t('Збережено')}: <time dateTime={savedAt!}>{timestamp}</time>
        </Text> : null}
        {loading ? <Text role="status" size="sm">{t('Завантаження наборів даних…')}</Text> : null}
        {error ? <Alert color="red">{t(error)}</Alert> : null}
        <Group gap="xs" wrap="wrap">
          <Button type="button" styles={actionStyles} disabled={loading || !canRestore} onClick={onRestore}>
            {t('Відновити чернетку')}
          </Button>
          <Button type="button" styles={actionStyles} variant="default" onClick={onDiscard}>
            {t('Відкинути чернетку')}
          </Button>
          {error && onRetry ? <Button type="button" styles={actionStyles} variant="light" disabled={loading} onClick={onRetry}>
            {t('Спробувати ще раз')}
          </Button> : null}
        </Group>
      </Stack>
    </Paper>
  )
}

export function ReportDraftStatus({ savedAt, notice, canUndo, disabled = false, onUndo }: ReportDraftStatusProps) {
  const { t } = useI18n()
  const timestamp = savedTime(savedAt)
  if (!timestamp && !notice && !canUndo) return null

  return (
    <Group component="section" aria-label={t('Чернетка звіту')} gap="xs" justify="space-between" wrap="wrap">
      {timestamp || notice ? <Stack gap={2}>
        {timestamp ? <Text role="status" size="xs" c="dimmed">
          {t('Чернетка збережена в цій вкладці')}: <time dateTime={savedAt!}>{timestamp}</time>
        </Text> : null}
        {notice ? <Text role="status" size="sm" c="orange">{t(notice)}</Text> : null}
      </Stack> : null}
      {canUndo ? <Button type="button" styles={actionStyles} size="xs" variant="light" disabled={disabled} onClick={onUndo}>
        {t('Повернути попередні налаштування')}
      </Button> : null}
    </Group>
  )
}
