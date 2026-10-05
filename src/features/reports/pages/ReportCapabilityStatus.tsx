import { Button, Loader, Text } from '@mantine/core'
import { useI18n } from '../../../shared/i18n/useI18n'

export type ReportCapabilityStatusProps = {
  current: { failed: boolean } | null; enabled: boolean; callerKey: string | null; disabled: boolean; retry: () => void
}

// Status presentation only; each original owns its capability request, permission and retry attempt.
export function ReportCapabilityStatus({ current, enabled, callerKey, disabled, retry, loadingLabel, failureMessage }: ReportCapabilityStatusProps & {
  loadingLabel: string; failureMessage: string
}) {
  const { t } = useI18n()
  return <>
    {!current && enabled && callerKey ? <Loader size="xs" aria-label={t(loadingLabel)} /> : null}
    {enabled && !callerKey ? <Text size="xs">{t('Для формування потрібен чинний сеанс користувача.')}</Text> : null}
    {current?.failed ? <><Text size="xs">{t(failureMessage)}</Text><Button variant="subtle" disabled={disabled} onClick={retry}>{t('Повторити')}</Button></> : null}
  </>
}
