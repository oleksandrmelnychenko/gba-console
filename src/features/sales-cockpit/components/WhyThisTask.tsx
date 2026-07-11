import { ActionIcon, Badge, Collapse, Group, List, Stack, Text } from '@mantine/core'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { CockpitTask } from '../types'

export function WhyThisTask({ task }: { task: CockpitTask }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const factors = task.explanation?.factors ?? []
  const sourceSignal = task.explanation?.source_signal ?? ''
  const confidence = task.explanation?.confidence
  const signalEntries = Object.entries(task.signals ?? {})

  return (
    <Stack gap={4}>
      <Group gap={4} wrap="nowrap">
        <ActionIcon aria-label={t('Чому це завдання')} size="sm" variant="subtle" onClick={() => setExpanded((current) => !current)}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </ActionIcon>
        <Text c="dimmed" size="xs" fw={600} style={{ cursor: 'pointer' }} onClick={() => setExpanded((current) => !current)}>
          {t('Чому це завдання')}
        </Text>
        {typeof confidence === 'number' && (
          <Badge className="app-role-pill is-gray" size="xs" variant="light">
            {t('Впевненість')}: {formatConfidence(confidence)}
          </Badge>
        )}
      </Group>

      <Collapse expanded={expanded}>
        <Stack gap="xs" pl={28} pt={4}>
          {factors.length > 0 && (
            <List size="xs" spacing={2}>
              {factors.map((factor, index) => (
                <List.Item key={`${factor}-${index}`}>{factor}</List.Item>
              ))}
            </List>
          )}

          {sourceSignal && (
            <Text c="dimmed" size="xs">
              {t('Джерело сигналу')}: {sourceSignal}
            </Text>
          )}

          {signalEntries.length > 0 && (
            <Stack gap={2}>
              {signalEntries.map(([key, value]) => (
                <Text c="dimmed" key={key} size="xs">
                  {key}: {formatSignalValue(value)}
                </Text>
              ))}
            </Stack>
          )}

          {factors.length === 0 && !sourceSignal && signalEntries.length === 0 && (
            <Text c="dimmed" size="xs">
              {t('Пояснення відсутнє')}
            </Text>
          )}
        </Stack>
      </Collapse>
    </Stack>
  )
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

function formatSignalValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') {
    return '-'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}
