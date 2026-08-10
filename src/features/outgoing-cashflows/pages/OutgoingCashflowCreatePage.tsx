import { Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { useI18n } from '../../../shared/i18n/useI18n'
import { OutgoingCashOrderForm } from '../components/OutgoingCashOrderForm'
import { OutgoingCreateModeSelector } from '../components/OutgoingCreateModeSelector'
import { OutgoingPaymentGroupForm } from '../components/OutgoingPaymentGroupForm'
import {
  OUTGOING_CREATE_MODE,
  resolveOutgoingCreateMode,
  type OutgoingCreateMode,
} from '../outgoingCreateTypes'
import {
  getOutgoingPaymentGroupTitle,
  parseOutgoingPaymentOperationType,
  parseOutgoingPaymentRegisterType,
} from '../outgoingPaymentGroupTitle'
import './outgoing-cashflows-page.css'

const OUTGOING_CASHFLOWS_PATH = '/accounting/outgoing-cashflow'
const OUTGOING_CASHFLOW_NEW_PATH = `${OUTGOING_CASHFLOWS_PATH}/new`

export function OutgoingCashflowCreatePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [paymentGroupTitle, setPaymentGroupTitle] = useState(
    () =>
      getOutgoingPaymentGroupTitle(
        parseOutgoingPaymentOperationType(
          searchParams.get('operationType'),
        ),
        parseOutgoingPaymentRegisterType(
          searchParams.get('type'),
        ),
        t,
      ),
  )
  const activeMode = resolveOutgoingCreateMode(
    location.pathname,
    searchParams.get('operationType'),
  )
  const drawerTitle = activeMode === OUTGOING_CREATE_MODE.Simple
    ? t('Створення нового видаткового ордера')
    : activeMode === OUTGOING_CREATE_MODE.PaymentGroup
      ? paymentGroupTitle || t('Створення нового видаткового ордера')
      : t('Створення видаткової статті бюджету')

  function handleNavigate(path: string) {
    if (path.startsWith(OUTGOING_CASHFLOW_NEW_PATH)) {
      const nextUrl = new URL(path, window.location.origin)
      setPaymentGroupTitle(
        getOutgoingPaymentGroupTitle(
          parseOutgoingPaymentOperationType(
            nextUrl.searchParams.get('operationType'),
          ),
          parseOutgoingPaymentRegisterType(
            nextUrl.searchParams.get('type'),
          ),
          t,
        ),
      )
      // Лишаємось у тому самому drawer-оверлеї — зберігаємо backgroundLocation.
      navigate(path, { replace: true, state: location.state })
      return
    }

    setPaymentGroupTitle('')
    navigate(path)
  }

  function handleBackToSelector() {
    setPaymentGroupTitle('')
    navigate(OUTGOING_CASHFLOW_NEW_PATH, { replace: true })
  }

  function handleCreated() {
    notifications.show({
      color: 'green',
      message: t('Створення нового видаткового ордера'),
    })
    navigate(OUTGOING_CASHFLOWS_PATH, { replace: true, state: { mutated: true } })
  }

  function renderActiveForm(nextMode: OutgoingCreateMode) {
    if (nextMode === OUTGOING_CREATE_MODE.Simple) {
      return <OutgoingCashOrderForm onCancel={handleBackToSelector} onCreated={handleCreated} />
    }

    if (nextMode === OUTGOING_CREATE_MODE.PaymentGroup) {
      return (
        <OutgoingPaymentGroupForm
          onCancel={handleBackToSelector}
          onCreated={handleCreated}
          onTitleChange={setPaymentGroupTitle}
        />
      )
    }

    return <OutgoingCreateModeSelector onNavigate={handleNavigate} />
  }

  return (
    <AppDrawer
      className="outgoing-cashflow-create-drawer"
      opened
      position="right"
      size="standard"
      title={<span style={{ fontFamily: 'var(--font-mono)' }}>{drawerTitle}</span>}
      onClose={() => navigate(OUTGOING_CASHFLOWS_PATH)}
    >
      <Stack gap="md">
        {activeMode ? renderActiveForm(activeMode) : <OutgoingCreateModeSelector onNavigate={handleNavigate} />}
      </Stack>
    </AppDrawer>
  )
}
