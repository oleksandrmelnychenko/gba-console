import { ActionIcon, Group, Text } from '@mantine/core'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import '../../../shared/ui/paginator/paginator.css'
import './report-inline-preview.css'

/** Pagination for a fully loaded report; totals always belong to the full result. */
export function ReportRowPagination({ total, offset, limit = 50, onChange, label = 'Сторінки звіту',
  previousLabel = 'Попередні рядки', nextLabel = 'Наступні рядки', rangeLabel }: {
  total: number; offset: number; limit?: number; onChange: (offset: number) => void
  label?: string; previousLabel?: string; nextLabel?: string; rangeLabel?: string
}) {
  const { t } = useI18n()
  return <Group className="app-paginator report-preview-footer__pagination" gap={4} wrap="nowrap" role="navigation" aria-label={t(label)}>
    <Text size="xs" className="report-preview-footer__range" aria-live="polite">
      {rangeLabel ? `${t(rangeLabel)}: ` : ''}{total ? `${offset + 1}–${Math.min(offset + limit, total)} ${t('із')} ${total}` : t('0 рядків')}
    </Text>
    <ActionIcon variant="subtle" color="gray" size={30} aria-label={t(previousLabel)} title={t(previousLabel)} disabled={offset === 0}
      onClick={() => onChange(Math.max(0, offset - limit))}><ChevronLeft size={16} /></ActionIcon>
    <ActionIcon variant="subtle" color="gray" size={30} aria-label={t(nextLabel)} title={t(nextLabel)} disabled={offset + limit >= total}
      onClick={() => onChange(offset + limit)}><ChevronRight size={16} /></ActionIcon>
  </Group>
}
