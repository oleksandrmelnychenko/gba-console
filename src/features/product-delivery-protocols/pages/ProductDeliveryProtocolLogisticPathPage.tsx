import { ActionIcon, Alert, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { UserRoleType } from '../../../shared/auth/types'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { getProtocolByNetId } from '../api/productDeliveryProtocolsApi'
import {
  assignInvoicesToMergedService,
  assignInvoicesToProtocol,
  calculateMergedServiceExtraCharge,
  addDocumentsToSupplyInvoice,
  removeMergedService,
  saveMergedService,
  updateProtocolStatus,
} from '../api/protocolDetailApi'
import type { MergedService, ProtocolDetail, SupplyInvoice } from '../detailTypes'
import { InvoicesSection } from '../components/InvoicesSection'
import {
  MergedServicesSection,
  type CalculateMergedServicePayload,
  type SaveMergedServicePayload,
} from '../components/MergedServicesSection'
import { ProtocolDetailsCard } from '../components/ProtocolDetailsCard'
import { StatusSection } from '../components/StatusSection'

function useLogisticPathModel(netId: string | undefined) {
  const { t } = useI18n()
  const { user } = useAuth()
  const isGba = user?.UserRole?.UserRoleType === UserRoleType.GBA
  const [protocol, setProtocol] = useValueState<ProtocolDetail | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const [isUpdating, setUpdating] = useValueState(false)
  const [isAssigning, setAssigning] = useValueState(false)
  const [isSavingInvoiceDocuments, setSavingInvoiceDocuments] = useValueState(false)
  const [isSavingService, setSavingService] = useValueState(false)

  useEffect(() => {
    if (!netId) {
      setProtocol(null)
      setLoading(false)
      setError(t('Помилка'))

      return
    }

    let cancelled = false

    async function loadProtocol(currentNetId: string) {
      setLoading(true)
      setError(null)

      try {
        const result = await getProtocolByNetId(currentNetId)

        if (cancelled) {
          return
        }

        if (result) {
          setProtocol(result as ProtocolDetail)

          const uncalculated = (result as ProtocolDetail).MergedServices?.filter(
            (service) => service.IsCalculatedValue === false,
          )

          if (uncalculated && uncalculated.length > 0) {
            notifications.show({
              color: 'yellow',
              message: `${t('Сервіс необхідно розрахувати')}: ${uncalculated
                .map((service) => service.ServiceNumber)
                .join(', ')}`,
            })
          }
        } else {
          setProtocol(null)
          setError(t('Помилка'))
        }
      } catch (loadError) {
        if (!cancelled) {
          setProtocol(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити протокол'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadProtocol(netId)

    return () => {
      cancelled = true
    }
  }, [netId, setError, setLoading, setProtocol, t])

  const canEdit = isGba || !protocol?.IsCompleted

  async function changeStatus() {
    if (!protocol?.NetUid) {
      return
    }

    setUpdating(true)

    try {
      const updated = await updateProtocolStatus(protocol.NetUid)

      if (updated) {
        setProtocol(updated)
      }
    } catch (statusError) {
      notifications.show({
        color: 'red',
        message: statusError instanceof Error ? statusError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setUpdating(false)
    }
  }

  async function assignInvoices(invoices: SupplyInvoice[]) {
    if (!protocol) {
      return
    }

    setAssigning(true)

    try {
      const updated = await assignInvoicesToProtocol(protocol, invoices)

      if (updated) {
        setProtocol(updated)
      }
    } catch (assignError) {
      notifications.show({
        color: 'red',
        message: assignError instanceof Error ? assignError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setAssigning(false)
    }
  }

  async function saveInvoiceDocuments(invoice: SupplyInvoice, documents: File[]) {
    setSavingInvoiceDocuments(true)

    try {
      const updated = await addDocumentsToSupplyInvoice(invoice, documents)

      if (updated) {
        setProtocol(updated)
      }
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setSavingInvoiceDocuments(false)
    }
  }

  async function saveService(payload: SaveMergedServicePayload) {
    if (!protocol?.NetUid) {
      return
    }

    setSavingService(true)

    try {
      const updated = await saveMergedService(protocol.NetUid, payload.service, payload.files)

      if (updated) {
        setProtocol(updated)
      }
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setSavingService(false)
    }
  }

  async function calculate(payload: CalculateMergedServicePayload) {
    setSavingService(true)

    try {
      const updated = await calculateMergedServiceExtraCharge(
        { extraChargeType: payload.extraChargeType, isAuto: payload.isAuto, serviceNetId: payload.serviceNetId },
        payload.invoices,
      )

      if (updated) {
        setProtocol(updated)
      }
    } catch (calculateError) {
      notifications.show({
        color: 'red',
        message: calculateError instanceof Error ? calculateError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setSavingService(false)
    }
  }

  async function assignServiceInvoices(service: MergedService, invoices: SupplyInvoice[]) {
    setSavingService(true)

    try {
      const updated = await assignInvoicesToMergedService(service, invoices)

      if (updated) {
        setProtocol(updated)
      }
    } catch (assignError) {
      notifications.show({
        color: 'red',
        message: assignError instanceof Error ? assignError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setSavingService(false)
    }
  }

  async function removeService(service: MergedService) {
    if (!service.NetUid) {
      return
    }

    setSavingService(true)

    try {
      const updated = await removeMergedService(service.NetUid)

      if (updated) {
        setProtocol(updated)
      }
    } catch (removeError) {
      notifications.show({
        color: 'red',
        message: removeError instanceof Error ? removeError.message : t('Не вдалося виконати запит'),
      })
    } finally {
      setSavingService(false)
    }
  }

  return {
    assignInvoices, assignServiceInvoices, calculate, canEdit, changeStatus, error, isAssigning, isLoading,
    isSavingInvoiceDocuments, isSavingService, isUpdating, protocol, removeService, saveInvoiceDocuments, saveService,
  }
}

export function ProductDeliveryProtocolLogisticPathPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const model = useLogisticPathModel(id)

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Group gap="sm" align="center">
          <Tooltip label={t('Назад')}>
            <ActionIcon
              aria-label={t('Назад')}
              color="gray"
              variant="light"
              onClick={() => navigate('/product-delivery-protocols')}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <Text fw={700} size="lg">
            {t('Протокол доставки товару')}
            {model.protocol?.DeliveryProductProtocolNumber?.Number
              ? ` (${model.protocol.DeliveryProductProtocolNumber.Number})`
              : ''}
          </Text>
        </Group>
        <Button color="gray" variant="light" onClick={() => navigate('/product-delivery-protocols')}>
          {t('Назад')}
        </Button>
      </Group>

      {model.error && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
          {model.error}
        </Alert>
      )}

      {model.isLoading ? (
        <Text c="dimmed" size="sm">
          {t('Завантаження')}
        </Text>
      ) : model.protocol ? (
        <Stack gap="lg">
          <ProtocolDetailsCard protocol={model.protocol} />

          {(model.protocol.SupplyInvoices?.length || 0) > 0 && (
            <StatusSection
              canEdit={model.canEdit}
              isUpdating={model.isUpdating}
              protocol={model.protocol}
              onChangeStatus={model.changeStatus}
            />
          )}

          <InvoicesSection
            canEdit={model.canEdit}
            isAssigning={model.isAssigning}
            isSavingInvoiceDocuments={model.isSavingInvoiceDocuments}
            protocol={model.protocol}
            onAssignInvoices={model.assignInvoices}
            onSaveInvoiceDocuments={model.saveInvoiceDocuments}
          />

          {((model.protocol.SupplyInvoices?.length || 0) > 0 ||
            (model.protocol.MergedServices?.length || 0) > 0) && (
            <MergedServicesSection
              canEdit={model.canEdit}
              isSaving={model.isSavingService}
              protocol={model.protocol}
              onAssignServiceInvoices={model.assignServiceInvoices}
              onCalculate={model.calculate}
              onRemoveService={model.removeService}
              onSaveService={model.saveService}
            />
          )}
        </Stack>
      ) : null}
    </Stack>
  )
}
