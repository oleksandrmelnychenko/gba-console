import { useBusyState } from '../../../shared/hooks/useBusyState'
import { getClientDisplayName } from '../clientDisplayName'
import { Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Ellipsis } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { getClientForRegistryById } from '../api/clientFormApi'
import { switchClientActiveStateForRegistry, updateClientOrderExpireDaysForRegistry } from '../api/clientsApi'
import { useClientSourceOwnership } from '../clientSourceOwnership'
import type { Client } from '../types'
import { ClientActionsModal, ClientStructureModal, ReserveDaysModal } from './ClientActionModals'

/** The registry's client actions, available without leaving a client report. */
export function ClientActionsButton({ netUid, onChanged }: { netUid: string; onChanged: () => void }) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { isSourceManagedClient } = useClientSourceOwnership()
  const location = useLocation()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [panel, setPanel] = useState<'actions' | 'reserve' | 'structure' | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving, tryStartSaving] = useBusyState()
  const [days, setDays] = useState(0)
  const request = useRef(0)
  const keys = PermissionKeys.Clients
  const canView = hasPermission(keys.Details.Open)
  const canReserve = hasPermission(keys.ReservationDays.Edit)
  const canStructure = hasPermission(keys.Structure.Open)
  const canToggle = hasPermission(keys.Status.ToggleActive)

  useEffect(() => () => { request.current += 1 }, [netUid])

  function showError(error: unknown) {
    notifications.show({ color: 'red', message: error instanceof Error ? error.message : t('Не вдалося виконати дію') })
  }

  async function open() {
    const current = ++request.current
    setLoading(true)
    try {
      const result = await getClientForRegistryById(netUid)
      if (request.current !== current) return
      if (!result) throw new Error(t('Клієнта не знайдено'))
      setClient(result)
      setPanel('actions')
    } catch (error) {
      if (request.current === current) showError(error)
    } finally {
      if (request.current === current) setLoading(false)
    }
  }

  if (!canView && !canReserve && !canStructure && !canToggle) return null

  return <>
    <Button color="orange" variant="filled" size="sm" leftSection={<Ellipsis size={16} />} loading={loading} onClick={open}>
      {t('Дії клієнта')}
    </Button>
    <ClientActionsModal
      client={panel === 'actions' ? client : null}
      canViewClient={canView}
      canEditReservationDays={canReserve}
      canOpenStructure={canStructure}
      canToggleActive={canToggle}
      canOpenCashFlow={false}
      isActiveLoading={saving}
      onClose={() => setPanel(null)}
      onCashFlow={() => setPanel(null)}
      onEdit={(selected) => {
        if (!hasPermission(keys.Details.Open)) return
        setPanel(null)
        navigate(`/clients/edit/${selected.NetUid}/general-information`, { state: {
          backgroundLocation: location,
          returnPath: `${location.pathname}${location.search}`,
          moduleTitle: t('Клієнти'),
          nodeTitle: getClientDisplayName(selected),
        } })
      }}
      onReserveDays={(selected) => {
        if (!hasPermission(keys.ReservationDays.Edit)) return
        setDays(Number(selected.OrderExpireDays ?? 0))
        setPanel('reserve')
      }}
      onStructure={() => {
        if (hasPermission(keys.Structure.Open)) setPanel('structure')
      }}
      onSwitchActive={async (selected) => {
        if (saving || !hasPermission(keys.Status.ToggleActive) || !selected.NetUid || isSourceManagedClient(selected)) return
        if (!tryStartSaving()) {
          return
        }
        try {
          await switchClientActiveStateForRegistry(selected.NetUid)
          setClient({ ...selected, IsActive: selected.IsActive === false })
          onChanged()
          notifications.show({ color: 'green', message: t('Статус клієнта оновлено') })
        } catch (error) { showError(error) } finally { setSaving(false) }
      }}
    />
    <ReserveDaysModal
      client={panel === 'reserve' && canReserve ? client : null}
      days={days}
      isSaving={saving}
      onChangeDays={setDays}
      onClose={() => setPanel('actions')}
      onSubmit={async (event) => {
        event.preventDefault()
        if (saving || !hasPermission(keys.ReservationDays.Edit) || !client?.NetUid) return
        const nextDays = Math.max(0, Math.trunc(days))
        if (!tryStartSaving()) {
          return
        }
        try {
          await updateClientOrderExpireDaysForRegistry(client.NetUid, nextDays)
          setClient({ ...client, OrderExpireDays: nextDays })
          setPanel('actions')
          onChanged()
          notifications.show({ color: 'green', message: t('Дні резерву оновлено') })
        } catch (error) { showError(error) } finally { setSaving(false) }
      }}
    />
    <ClientStructureModal
      client={panel === 'structure' && canStructure ? client : null}
      canManageIdentity={hasPermission(keys.IdentityReview.Manage)}
      onClose={() => setPanel('actions')}
    />
  </>
}
