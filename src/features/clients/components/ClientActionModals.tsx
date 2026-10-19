import { Alert, Badge, Button, Divider, Group, Loader, NumberInput, Stack } from '@mantine/core'
import { ChevronRight, CircleAlert, Clock, ExternalLink, Network, ToggleLeft, ToggleRight, Wallet } from 'lucide-react'
import { type FormEvent, useEffect, useReducer, useState } from 'react'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getClientDisplayName } from '../clientDisplayName'
import { getClientCommercialStructureForRegistry, mutateClientIdentityForStructure } from '../api/clientsApi'
import { isSourceManagedClient } from '../clientSourceOwnership'
import { ClientCommercialStructureView } from './structure/ClientCommercialStructureView'
import type { Client, ClientCommercialStructure } from '../types'
import '../pages/clients-page.css'

type ClientActionsModalProps = {
  canEditReservationDays: boolean
  canOpenCashFlow: boolean
  canOpenStructure: boolean
  canToggleActive: boolean
  canViewClient: boolean
  client: Client | null
  isActiveLoading: boolean
  onCashFlow: (client: Client) => void
  onClose: () => void
  onEdit: (client: Client) => void
  onReserveDays: (client: Client) => void
  onStructure: (client: Client) => void
  onSwitchActive: (client: Client) => void
}

export function ClientActionsModal({
  canEditReservationDays,
  canOpenCashFlow,
  canOpenStructure,
  canToggleActive,
  canViewClient,
  client,
  isActiveLoading,
  onCashFlow,
  onClose,
  onEdit,
  onReserveDays,
  onStructure,
  onSwitchActive,
}: ClientActionsModalProps) {
  const { t } = useI18n()
  const isActive = client?.IsActive !== false
  const canSwitchActive = canToggleActive && !isSourceManagedClient(client)
  const [structureCountResult, setStructureCountResult] = useState<{
    clientNetUid: string
    count: number | null
  } | null>(null)
  const structureCardCount = structureCountResult && structureCountResult.clientNetUid === client?.NetUid
    ? structureCountResult.count
    : null

  useEffect(() => {
    const netUid = client?.NetUid
    if (!canOpenStructure || !netUid) {
      return
    }

    const controller = new AbortController()
    void getClientCommercialStructureForRegistry(netUid, controller.signal)
      .then((structure) => {
        if (!controller.signal.aborted) {
          setStructureCountResult({
            clientNetUid: netUid,
            count: structure?.CardCount ?? null,
          })
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) {
          setStructureCountResult({ clientNetUid: netUid, count: null })
        }
      })

    return () => controller.abort()
  }, [canOpenStructure, client?.NetUid])

  return (
    <AppModal
      centered
      size={496}
      opened={Boolean(client)}
      className="client-actions-modal"
      title={client ? getClientDisplayName(client) : t('Клієнт')}
      onClose={onClose}
    >
      {client && (
        <Stack gap={10}>
          <Group gap={6}>
            {String(client.RegionCode?.Value || '').trim() && (
              <Badge className="app-role-pill is-blue" variant="light">
                {String(client.RegionCode?.Value || '').trim()}
              </Badge>
            )}
            <Badge className={`app-role-pill ${isActive ? 'is-green' : 'is-gray'}`} variant="light">
              {isActive ? t('Активний') : t('Неактивний')}
            </Badge>
          </Group>

          <Stack className="app-modal-actions" gap="xs">
            {canViewClient && (
              <Button
                fullWidth
                justify="flex-start"
                color="dark"
                size="md"
                leftSection={
                  <span className="app-action-icon">
                    <ExternalLink size={20} color="var(--mantine-color-gray-7)" />
                  </span>
                }
                rightSection={<ChevronRight size={16} aria-hidden="true" />}
                variant="subtle"
                onClick={() => onEdit(client)}
              >
                {t('Відкрити картку')}
              </Button>
            )}
            {canOpenCashFlow && (
              <Button
                fullWidth
                justify="flex-start"
                color="dark"
                size="md"
                leftSection={
                  <span className="app-action-icon">
                    <Wallet size={20} color="var(--mantine-color-gray-7)" />
                  </span>
                }
                rightSection={<ChevronRight size={16} aria-hidden="true" />}
                variant="subtle"
                onClick={() => onCashFlow(client)}
              >
                {t('Взаєморозрахунки')}
              </Button>
            )}
            {canEditReservationDays && (
              <Button
                fullWidth
                justify="flex-start"
                color="dark"
                size="md"
                leftSection={
                  <span className="app-action-icon">
                    <Clock size={20} color="var(--mantine-color-gray-7)" />
                  </span>
                }
                rightSection={<ChevronRight size={16} aria-hidden="true" />}
                variant="subtle"
                onClick={() => onReserveDays(client)}
              >
                {t('Дні резерву')}
              </Button>
            )}
            {canOpenStructure && (
              <Button
                fullWidth
                justify="flex-start"
                color="dark"
                size="md"
                leftSection={
                  <span className="app-action-icon">
                    <Network size={20} color="var(--mantine-color-gray-7)" />
                  </span>
                }
                aria-label={`${t('Структура клієнта')}${structureCardCount == null ? '' : ` (${structureCardCount})`}`}
                rightSection={
                  <Group gap={8} wrap="nowrap" aria-hidden="true">
                    {structureCardCount != null && <Badge className="app-role-pill is-gray" variant="light">{structureCardCount}</Badge>}
                    <ChevronRight size={16} />
                  </Group>
                }
                variant="subtle"
                onClick={() => onStructure(client)}
              >
                {t('Структура клієнта')}
              </Button>
            )}
          </Stack>

          {canSwitchActive ? (
            <>
              <Divider />
              <Button
                fullWidth
                color={isActive ? 'gray' : 'green'}
                justify="flex-start"
                leftSection={isActive ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                loading={isActiveLoading}
                variant="light"
                onClick={() => onSwitchActive(client)}
              >
                {isActive ? t('Позначити неактивним') : t('Позначити активним')}
              </Button>
            </>
          ) : null}
        </Stack>
      )}
    </AppModal>
  )
}

export function ReserveDaysModal({
  client,
  days,
  isSaving,
  onChangeDays,
  onClose,
  onSubmit,
}: {
  client: Client | null
  days: number
  isSaving: boolean
  onChangeDays: (value: number) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useI18n()

  return (
    <AppModal
      centered
      opened={Boolean(client)}
      title={client ? `${t('Резерв')}: ${getClientDisplayName(client)}` : t('Резерв')}
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          <NumberInput
            allowDecimal={false}
            label={t('Днів резерву')}
            min={0}
            value={days}
            onChange={(value) => onChangeDays(Number(value) || 0)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('Скасувати')}
            </Button>
            <Button color={CREATE_ACTION_COLOR} loading={isSaving} type="submit">
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

export function ClientStructureModal({
  canManageIdentity,
  client,
  onClose,
}: {
  canManageIdentity: boolean
  client: Client | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [structure, setStructure] = useValueState<ClientCommercialStructure | null>(null)
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)
  const [structureReloadKey, reloadStructure] = useReducer((key: number) => key + 1, 0)

  useEffect(() => {
    const netUid = client?.NetUid
    if (!netUid) {
      setStructure(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)

    void getClientCommercialStructureForRegistry(netUid, controller.signal)
      .then((result) => {
        if (cancelled) {
          return
        }
        setStructure(result)
        if (!result) {
          setError(t('Сервер повернув неповну структуру клієнта'))
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setStructure(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити структуру клієнта'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [client?.NetUid, setError, setLoading, setStructure, structureReloadKey, t])

  return (
    <AppModal
      centered
      className="client-commercial-structure-modal"
      opened={Boolean(client)}
      size="min(1120px, 94vw)"
      title={client ? `${t('Структура клієнта')} · ${getClientDisplayName(client)}` : t('Структура клієнта')}
      onClose={onClose}
    >
      {isLoading ? (
        <Group justify="center" py="xl"><Loader size="sm" /></Group>
      ) : error ? (
        <Alert color="red" icon={<CircleAlert size={18} />} variant="light">{error}</Alert>
      ) : structure ? (
        <ClientCommercialStructureView
          canManageIdentity={canManageIdentity}
          mutateIdentity={mutateClientIdentityForStructure}
          structure={structure}
          t={t}
          onChanged={reloadStructure}
        />
      ) : null}
    </AppModal>
  )
}

