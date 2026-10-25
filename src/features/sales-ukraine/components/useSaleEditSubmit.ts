import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { useSingleFlight } from '../../../shared/hooks/useSingleFlight'
import { useI18n } from '../../../shared/i18n/useI18n'
import { shiftOrderItemsCurrent } from '../api/salesUkraineApi'
import { usePersistentSaleJsonMutation } from '../usePersistentSaleJsonMutation'
import type { SalesUkraineSale } from '../types'

type Options = { context: string; ready: boolean; onSaved: () => void | Promise<void> }

/** One UI completion for submit/recovery, while the durable mutation retains
 * ownership of any already submitted write after this edit session closes. */
export function useSaleEditSubmit({ context, ready, onSaved }: Options) {
  const { t } = useI18n()
  const mutation = usePersistentSaleJsonMutation(context, 'sale-shift-current')
  const [isSaving, setSaving] = useState(false)
  const once = useSingleFlight()
  const epochRef = useRef(0)
  const attemptedRecoveryRef = useRef(false)
  const latest = useRef({ mutation, onSaved, t })
  useLayoutEffect(() => { latest.current = { mutation, onSaved, t } })
  useLayoutEffect(() => {
    attemptedRecoveryRef.current = false
    return () => { epochRef.current += 1 }
  }, [context])

  const execute = useCallback((payload?: SalesUkraineSale) => once(context, async () => {
    const epoch = epochRef.current
    const current = () => epochRef.current === epoch
    attemptedRecoveryRef.current = true
    setSaving(true)
    try {
      const result = payload
        ? await latest.current.mutation.run(payload, shiftOrderItemsCurrent)
        : await latest.current.mutation.resume(shiftOrderItemsCurrent)
      if (!current() || !result.completed) return
      notifications.show({ color: 'green', message: latest.current.t(payload ? 'Зсув виконано' : 'Попередню операцію підтверджено') })
      try {
        await latest.current.onSaved()
      } catch {
        if (current()) notifications.show({ color: 'orange', message: latest.current.t('Зміни збережено, але не вдалося оновити реєстр') })
      }
    } catch (error) {
      if (current()) notifications.show({
        color: 'red',
        message: error instanceof Error && error.message.trim()
          ? error.message
          : latest.current.t(payload ? 'Не вдалося виконати зсув' : 'Не вдалося перевірити попередню операцію'),
      })
    } finally {
      if (current()) setSaving(false)
    }
  }), [context, once])

  useEffect(() => {
    if (ready && mutation.hasPending && !attemptedRecoveryRef.current) void execute()
  }, [execute, mutation.hasPending, ready])
  const recover = useCallback(() => execute(), [execute])
  return { isSaving, hasPending: mutation.hasPending, pendingError: mutation.pendingError, submit: execute, recover }
}
