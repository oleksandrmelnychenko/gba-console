import { Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { OutgoingCashOrderForm } from '../components/OutgoingCashOrderForm'
import { OutgoingClientReturnForm } from '../components/OutgoingClientReturnForm'
import { OutgoingCreateModeSelector } from '../components/OutgoingCreateModeSelector'
import { OutgoingOrganizationPaymentForm } from '../components/OutgoingOrganizationPaymentForm'
import { OutgoingPaymentGroupForm } from '../components/OutgoingPaymentGroupForm'
import { OUTGOING_CREATE_MODE, type OutgoingCreateMode } from '../outgoingCreateTypes'
import { buildAvailablePaymentsPaymentTasksPath } from '../outgoingPaymentTasksRoute'

const OUTGOING_CASHFLOWS_PATH = '/accounting/outgoing-cashflow'
const OUTGOING_CASHFLOW_NEW_PATH = `${OUTGOING_CASHFLOWS_PATH}/new`

export function OutgoingCashflowCreatePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useValueState<OutgoingCreateMode | null>(null)
  const activeMode = mode || getModeFromPath(location.pathname) || (searchParams.get('operationType') ? OUTGOING_CREATE_MODE.PaymentGroup : null)

  // Deep link на /new/payment-tasks — редірект на сторінку платіжних задач.
  if (location.pathname.endsWith('/payment-tasks')) {
    navigate(buildAvailablePaymentsPaymentTasksPath(location.search, location.hash), { replace: true })
  }

  function handleNavigate(path: string) {
    if (path.startsWith(OUTGOING_CASHFLOW_NEW_PATH)) {
      // Лишаємось у тому самому drawer-оверлеї — зберігаємо backgroundLocation.
      setMode(null)
      navigate(path, { replace: true, state: location.state })
      return
    }

    navigate(path)
  }

  function handleBackToSelector() {
    setMode(null)
    navigate(OUTGOING_CASHFLOW_NEW_PATH, { replace: true })
  }

  function handleCreated() {
    notifications.show({
      color: 'green',
      message: t('Створення нового видаткового ордера'),
    })
    navigate(OUTGOING_CASHFLOWS_PATH, { replace: true })
  }

  function renderActiveForm(nextMode: OutgoingCreateMode) {
    if (nextMode === OUTGOING_CREATE_MODE.Simple) {
      return <OutgoingCashOrderForm onCancel={handleBackToSelector} onCreated={handleCreated} />
    }

    if (nextMode === OUTGOING_CREATE_MODE.OrganizationPayment) {
      return <OutgoingOrganizationPaymentForm onCancel={handleBackToSelector} onCreated={handleCreated} />
    }

    if (nextMode === OUTGOING_CREATE_MODE.ClientReturn) {
      return <OutgoingClientReturnForm onCancel={handleBackToSelector} onCreated={handleCreated} />
    }

    if (nextMode === OUTGOING_CREATE_MODE.PaymentGroup) {
      return <OutgoingPaymentGroupForm onCancel={handleBackToSelector} onCreated={handleCreated} />
    }

    return <OutgoingCreateModeSelector onNavigate={handleNavigate} />
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="standard"
      title={t('Створення видаткової статті бюджету')}
      onClose={() => navigate(OUTGOING_CASHFLOWS_PATH)}
    >
      <Stack gap="md">
        {activeMode ? renderActiveForm(activeMode) : <OutgoingCreateModeSelector onNavigate={handleNavigate} />}
      </Stack>
    </AppDrawer>
  )
}

function getModeFromPath(pathname: string): OutgoingCreateMode | null {
  if (pathname.endsWith('/simple')) {
    return OUTGOING_CREATE_MODE.Simple
  }

  if (pathname.endsWith('/supplier')) {
    return OUTGOING_CREATE_MODE.OrganizationPayment
  }

  if (pathname.endsWith('/client-return')) {
    return OUTGOING_CREATE_MODE.ClientReturn
  }

  if (pathname.endsWith('/group')) {
    return OUTGOING_CREATE_MODE.PaymentGroup
  }

  return null
}
