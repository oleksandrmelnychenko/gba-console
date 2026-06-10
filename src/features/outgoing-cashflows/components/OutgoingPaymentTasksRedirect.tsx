import { Navigate, useLocation } from 'react-router-dom'
import { buildAvailablePaymentsPaymentTasksPath } from '../outgoingPaymentTasksRoute'

export function OutgoingPaymentTasksRedirect() {
  const location = useLocation()

  return (
    <Navigate
      replace
      to={buildAvailablePaymentsPaymentTasksPath(location.search, location.hash)}
    />
  )
}
