import { Alert, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { memo } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'

/** Failed reads retain their warning until a retry succeeds. */
export const WizardClientLoadFeedback = memo(function WizardClientLoadFeedback({
  error, loading, errorText, loadingText, retryLabel, onRetry,
}: {
  error: boolean
  loading: boolean
  errorText: string
  loadingText: string
  retryLabel: string
  onRetry: () => Promise<boolean>
}) {
  const { t } = useI18n()
  if (error) return (
    <Alert color="orange" icon={<CircleAlert size={18} />} role="alert" mb="xs">
      <Stack gap="xs">
        <Text size="sm">{t(errorText)}</Text>
        <Button size="xs" variant="light" loading={loading} onClick={onRetry} style={{ alignSelf: 'flex-start' }}>
          {t(retryLabel)}
        </Button>
      </Stack>
    </Alert>
  )
  return loading ? (
    <Group gap="xs" role="status" mb="xs">
      <Loader size="xs" aria-hidden="true" />
      <Text size="sm" c="dimmed">{t(loadingText)}</Text>
    </Group>
  ) : null
})
