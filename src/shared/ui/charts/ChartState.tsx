import { Center, Loader, Text } from '@mantine/core'
import type { ReactNode } from 'react'

type ChartStateProps = {
  height?: number
  children: ReactNode
}

export function ChartLoading({ height = 200, label }: { height?: number; label: string }) {
  return (
    <Center h={height} style={{ flexDirection: 'column', gap: 8 }}>
      <Loader color="violet" size="sm" />
      <Text c="dimmed" size="sm">
        {label}
      </Text>
    </Center>
  )
}

export function ChartEmpty({ height = 200, label }: { height?: number; label: string }) {
  return (
    <Center h={height}>
      <Text c="dimmed" size="sm">
        {label}
      </Text>
    </Center>
  )
}

export function ChartFrame({ height = 200, children }: ChartStateProps) {
  return <div style={{ height, width: '100%' }}>{children}</div>
}
