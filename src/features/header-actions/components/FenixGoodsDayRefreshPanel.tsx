import { Alert, Button, Stack, Text } from '@mantine/core'
import { useContext, useEffect, useRef, useState } from 'react'
import { AuthContext } from '../../auth/AuthContext'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { ApiError } from '../../../shared/api/apiClient'
import { useI18n } from '../../../shared/i18n/useI18n'
import { goodsRefreshMessage, isClosedGoodsDay, refreshGoodsDay } from '../goodsDayRefresh'
import type { SyncDateRange, SyncMode, SyncSource } from '../syncSessionForm'

type Props = {
  visible: boolean
  mode: SyncMode
  source: SyncSource
  range: SyncDateRange
  blocked: boolean
  onPendingChange: (pending: boolean) => void
}

export function FenixGoodsDayRefreshPanel(props: Props) {
  const auth = useContext(AuthContext)
  const authorized = auth?.isAuthenticated && !auth.isLoading && !auth.isPermissionsLoading
    && auth.hasPermission(PermissionKeys.OnlineShopSeo.Synchronization.Run)
  if (!authorized || !props.visible || props.mode !== 'daily' || props.source !== 'fenix') return null
  // Scope/session changes unmount the request owner; a late response cannot describe another day/user.
  return <DayRefreshControl key={`${props.range.from}/${props.range.to}/${auth.session?.userNetUid ?? ''}`}
    {...props} />
}

function DayRefreshControl({ range, blocked, onPendingChange }: Props) {
  const { t } = useI18n()
  const [view, setView] = useState<{ status: 'idle' | 'pending' } |
    { status: 'result'; message: string; completed: boolean }>({ status: 'idle' })
  const request = useRef<AbortController | null>(null)
  const validDay = range.from === range.to && isClosedGoodsDay(range.from)

  useEffect(() => () => {
    request.current?.abort()
    request.current = null
    onPendingChange(false)
  }, [onPendingChange])

  async function run() {
    if (!validDay || blocked || request.current) return
    const controller = new AbortController()
    request.current = controller
    setView({ status: 'pending' })
    onPendingChange(true)
    try {
      const response = await refreshGoodsDay(range.from, controller.signal)
      if (!controller.signal.aborted && request.current === controller)
        setView({ status: 'result', message: goodsRefreshMessage(response), completed: response.Status === 2 })
    } catch (error) {
      if (!controller.signal.aborted && request.current === controller)
        setView({ status: 'result', completed: false, message: error instanceof ApiError && error.status === 403
          ? 'Немає дозволу на оновлення класифікації товарів.'
          : 'Результат оновлення не підтверджено. Перевірте стан синхронізації та звіт перед повторним запуском.' })
    } finally {
      if (request.current === controller) {
        request.current = null
        onPendingChange(false)
      }
    }
  }

  return <Stack gap="xs">
    <Text fw={600} size="sm">{t('Класифікація товарів за добу Fenix')}</Text>
    <Text size="xs" c="dimmed">{t('Оновлює класифікацію товарів для продажів, які вже є в нашій базі.')}</Text>
    {!validDay ? <Text size="xs">{t('Оберіть однакові дати від і до: одну завершену добу за часом Києва.')}</Text> : null}
    <Button variant="light" disabled={!validDay || blocked} loading={view.status === 'pending'} onClick={() => void run()}>
      {t('Оновити класифікацію товарів за добу')}
    </Button>
    {view.status === 'result' ? <Alert role="status" color={view.completed ? 'green' : 'yellow'}>{t(view.message)}</Alert> : null}
  </Stack>
}
