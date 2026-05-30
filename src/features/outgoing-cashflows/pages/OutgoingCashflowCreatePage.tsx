import { Anchor, Breadcrumbs, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/useI18n'
import { OutgoingCashOrderForm } from '../components/OutgoingCashOrderForm'
import { OutgoingCreateModeSelector } from '../components/OutgoingCreateModeSelector'
import { OUTGOING_CREATE_MODE, type OutgoingCreateMode } from '../outgoingCreateTypes'
import { useValueState } from '../../../shared/hooks/useValueState'

const OUTGOING_CASHFLOWS_PATH = '/accounting/outgoing-cashflow'

export function OutgoingCashflowCreatePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [mode, setMode] = useValueState<OutgoingCreateMode | null>(null)

  function handleSelectMode(nextMode: OutgoingCreateMode) {
    setMode(nextMode)
  }

  function handleBackToSelector() {
    setMode(null)
  }

  function handleCreated() {
    notifications.show({
      color: 'green',
      message: t('Створення нового видаткового ордера'),
    })
    navigate(OUTGOING_CASHFLOWS_PATH, { replace: true })
  }

  return (
    <Stack gap="md">
      <Breadcrumbs>
        <Anchor onClick={() => navigate(OUTGOING_CASHFLOWS_PATH)}>{t('Створення видаткової статті бюджету')}</Anchor>
      </Breadcrumbs>

      {mode === OUTGOING_CREATE_MODE.Simple ? (
        <OutgoingCashOrderForm onCancel={handleBackToSelector} onCreated={handleCreated} />
      ) : (
        <OutgoingCreateModeSelector onSelect={handleSelectMode} />
      )}
    </Stack>
  )
}
