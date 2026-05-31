import { Group, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export function LabelValueRow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
      <Text c="dimmed" size="sm" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" fw={500} style={{ textAlign: 'right', wordBreak: 'break-word' }}>
        {children}
      </Text>
    </Group>
  )
}
