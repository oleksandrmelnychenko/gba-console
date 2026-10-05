import { Button, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { ReportCapabilityStatus, type ReportCapabilityStatusProps } from './ReportCapabilityStatus'

// Presentation only: each catalogue launcher owns its identity, request, permission and panel scope.
export function DiscountAnalysisCatalogueFrame({ current, enabled, callerKey, disabled, retry, allowed, opened, onOpen, onClose, title, description, closeLabel, children }: ReportCapabilityStatusProps & {
  allowed: boolean; opened: boolean; onOpen: () => void; onClose: () => void
  title: string; description: string; closeLabel: string; children: ReactNode
}) {
  const { t } = useI18n()
  return <Stack gap={6}><ReportCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={retry}
    loadingLabel="Перевірка доступності звіту" failureMessage="Не вдалося перевірити доступність звіту." />
    <Button disabled={!allowed} onClick={onOpen}>{t(title)}</Button>
    <Text size="sm" c="dimmed">{t(description)}</Text>
    <AppModal opened={opened && allowed} title={t(title)} size={1250} onClose={onClose} closeButtonProps={{ 'aria-label': t(closeLabel) }}>
      {children}
    </AppModal></Stack>
}
