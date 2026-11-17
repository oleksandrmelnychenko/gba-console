import { Alert, Button, Center, Loader, Stack, Text } from '@mantine/core'
import { CircleAlert, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

/** Fast session checks finish before anything is drawn, so a normal start does not flash. */
export const SESSION_BOOT_INDICATOR_DELAY_MS = 500
/** After this long without an answer the server is treated as unavailable. */
export const SESSION_BOOT_TIMEOUT_MS = 15_000

type BootStage = 'quiet' | 'loading' | 'unavailable'

/**
 * Shown while the session request is pending: a loader instead of a blank
 * page, and after 15 s «Сервер недоступний» with a retry (a reload also drops
 * the hung request).
 */
export function SessionBootScreen({ onRetry = () => window.location.reload() }: { onRetry?: () => void }) {
  const [stage, setStage] = useState<BootStage>('quiet')

  useEffect(() => {
    const indicatorTimer = window.setTimeout(() => setStage('loading'), SESSION_BOOT_INDICATOR_DELAY_MS)
    const timeoutTimer = window.setTimeout(() => setStage('unavailable'), SESSION_BOOT_TIMEOUT_MS)

    return () => {
      window.clearTimeout(indicatorTimer)
      window.clearTimeout(timeoutTimer)
    }
  }, [])

  if (stage === 'quiet') {
    return null
  }

  return (
    <Center mih="100vh" p="md">
      {stage === 'loading' ? (
        <Stack align="center" gap="xs" role="status">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">Завантаження…</Text>
        </Stack>
      ) : (
        <Alert color="red" icon={<CircleAlert size={18} />} maw={420} title="Сервер недоступний" variant="light">
          <Stack gap="sm">
            <Text size="sm">Сервер не відповідає. Перевірте з’єднання і спробуйте ще раз.</Text>
            <Button leftSection={<RefreshCw size={16} />} variant="light" onClick={onRetry}>
              Спробувати ще раз
            </Button>
          </Stack>
        </Alert>
      )}
    </Center>
  )
}
