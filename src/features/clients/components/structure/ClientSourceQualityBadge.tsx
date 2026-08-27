import { Badge, Text } from '@mantine/core'
import { Network } from 'lucide-react'
import type { ClientSourceQualitySummary } from '../../types'

type ClientSourceQualityBadgeProps = {
  quality?: ClientSourceQualitySummary
  t: (value: string) => string
  onClick?: () => void
}

export function ClientSourceQualityBadge({
  quality,
  t,
  onClick,
}: ClientSourceQualityBadgeProps) {
  if (!quality) {
    return <Text c="dimmed" size="xs">—</Text>
  }

  const isCritical = quality.Reasons.some((reason) =>
    reason === 'invalid_source_identity' || reason === 'source_marked_deleted')
  const color = quality.State === 'clean'
    ? 'teal'
    : quality.State === 'not_synced'
      ? 'gray'
      : isCritical
        ? 'red'
        : 'orange'
  const label = quality.State === 'clean'
    ? t('1С: перевірено')
    : quality.State === 'not_synced'
      ? t('Очікує синку')
      : t('Перевірити 1С')
  const sourceSystems = [
    quality.HasFenixSnapshot ? 'Fenix' : null,
    quality.HasAmgSnapshot ? 'AMG' : null,
  ].filter(Boolean).join(' + ')
  const title = [
    label,
    sourceSystems || null,
    ...quality.Reasons.map((reason) =>
      getSourceQualityReasonLabel(reason, t)),
  ].filter(Boolean).join(' · ')

  if (!onClick) {
    return (
      <Badge
        aria-label={title}
        className="client-source-quality-badge"
        color={color}
        leftSection={<Network size={11} />}
        size="xs"
        title={title}
        variant="light"
      >
        {label}
      </Badge>
    )
  }

  return (
    <Badge
      aria-label={title}
      className="client-source-quality-badge"
      color={color}
      component="button"
      leftSection={<Network size={11} />}
      size="xs"
      title={title}
      type="button"
      variant="light"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {label}
    </Badge>
  )
}

function getSourceQualityReasonLabel(
  reason: string,
  t: (value: string) => string,
): string {
  const labels: Record<string, string> = {
    source_snapshot_missing: t('Знімок 1С ще не отримано'),
    invalid_source_identity: t('Пошкоджений ID джерела'),
    source_marked_deleted: t('Картку видалено в 1С'),
    normalized_source_evidence: t('Пошкоджене значення нормалізовано'),
    invalid_region_code: t('Некоректний код регіону'),
    conflicting_region_code_family: t('Конфлікт кодів регіону'),
    invalid_legal_code: t('Некоректний юридичний код'),
    conflicting_legal_code: t('Конфлікт юридичних кодів'),
    conflicting_source_group_name: t('Конфлікт назв груп 1С'),
  }

  return labels[reason] || reason
}
