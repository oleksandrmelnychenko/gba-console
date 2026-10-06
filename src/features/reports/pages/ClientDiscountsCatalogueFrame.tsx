import { Button, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import type { ReportCapabilityStatusProps } from './ReportCapabilityStatus'
import { WarehousePeriodCapabilityStatus } from './WarehousePeriodControls'

// Each original retains its own identity, readiness request, permission and lazy panel.
export function ClientDiscountsCatalogueFrame({ current, enabled, callerKey, disabled, retry, allowed, opened, onOpen, onClose,
  title, closeLabel, unavailableLabel, unavailable, children }: ReportCapabilityStatusProps & {
  allowed: boolean; opened: boolean; onOpen: () => void; onClose: () => void
  title: string; closeLabel: string; unavailableLabel: string; unavailable: boolean; children: ReactNode
}) {
  const { t } = useI18n()
  return <Stack gap={6}><WarehousePeriodCapabilityStatus current={current} enabled={enabled} callerKey={callerKey} disabled={disabled} retry={retry} />
    <Button disabled={!allowed} onClick={onOpen}>{t(title)}</Button>
    {unavailable ? <Text size="sm" c="dimmed">{t(unavailableLabel)}</Text> : null}
    <AppModal opened={opened && allowed} title={t(title)} size={1250} onClose={onClose} closeButtonProps={{ 'aria-label': t(closeLabel) }}>
      {children}
    </AppModal></Stack>
}
