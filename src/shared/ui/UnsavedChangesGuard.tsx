import { Button, Stack, Text } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n/useI18n'
import { AppModal, AppModalFooter } from './AppModal'

/**
 * Asks before a filled form is closed (Escape, X, Скасувати) and before the
 * page is reloaded or left. `guard(close)` runs `close` at once for a pristine
 * form and only after «Закрити без збереження» for a dirty one.
 */
export function useUnsavedChangesGuard(isDirty: boolean, message?: string): {
  guard: (close: () => void) => void
  modal: ReactNode
} {
  const { t } = useI18n()
  const [pendingClose, setPendingClose] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (!isDirty) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  function guard(close: () => void) {
    if (isDirty) {
      setPendingClose(() => close)
      return
    }

    close()
  }

  const modal = (
    <AppModal
      centered
      className="app-compact-form"
      opened={Boolean(pendingClose)}
      title={t('Є незбережені зміни')}
      onClose={() => setPendingClose(null)}
    >
      <Stack gap="md">
        <Text>{message || t('Якщо закрити форму, введені дані не будуть збережені.')}</Text>
        <AppModalFooter>
          <Button color="gray" variant="default" onClick={() => setPendingClose(null)}>
            {t('Залишитися')}
          </Button>
          <Button
            color="red"
            onClick={() => {
              const close = pendingClose
              setPendingClose(null)
              close?.()
            }}
          >
            {t('Закрити без збереження')}
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  )

  return { guard, modal }
}
