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

type LogisticPathLoadState = {
  error: string | null
  isLoading: boolean
  protocol: ProtocolDetail | null
}

const INITIAL_LOGISTIC_PATH_LOAD_STATE: LogisticPathLoadState = {
  error: null,
  isLoading: true,
  protocol: null,
}
const PERMISSION_UPLOAD_DELIVERY_DOCUMENTS =
  'ProductDeliveryProtocols_specifications_download_exel_upload_documents_PKEY'

function useLogisticPathModel(netId: string | undefined) {
  const { t } = useI18n()
  const { hasPermission, user } = useAuth()
  const isGba = user?.UserRole?.UserRoleType === UserRoleType.GBA
  const [loadState, setLoadState] = useValueState<LogisticPathLoadState>(INITIAL_LOGISTIC_PATH_LOAD_STATE)
  const [isUpdating, setUpdating] = useValueState(false)
  const [isAssigning, setAssigning] = useValueState(false)
  const [isSavingInvoiceDocuments, setSavingInvoiceDocuments] = useValueState(false)
  const [isSavingService, setSavingService] = useValueState(false)
  const { error, isLoading, protocol } = loadState

  useEffect(() => {
    if (!netId) {
      setLoadState({
        ...INITIAL_LOGISTIC_PATH_LOAD_STATE,
        error: t('Помилка'),
        isLoading: false,
      })

      return
    }

    let cancelled = false

    async function loadProtocol(currentNetId: string) {
      setLoadState((current) => ({
        ...current,
        error: null,
        isLoading: true,
      }))

      try {
        const result = await getProtocolByNetId(currentNetId)

        if (cancelled) {
          return
        }

        if (result) {
          const loadedProtocol = result as ProtocolDetail
          setLoadState({
            error: null,
            isLoading: false,
            protocol: loadedProtocol,
          })

          const uncalculated = loadedProtocol.MergedServices?.filter(
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
          setLoadState({
            ...INITIAL_LOGISTIC_PATH_LOAD_STATE,
            error: t('Помилка'),
            isLoading: false,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setLoadState({
            ...INITIAL_LOGISTIC_PATH_LOAD_STATE,
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити протокол'),
            isLoading: false,
          })
        }
      }
    }

    void loadProtocol(netId)

    return () => {
      cancelled = true
    }
  }, [netId, setLoadState, t])

  const canEdit = isGba || !protocol?.IsCompleted
  const canEditDeliveryDocuments = canEdit && hasPermission(PERMISSION_UPLOAD_DELIVERY_DOCUMENTS)

  async function changeStatus() {
    if (!protocol?.NetUid) {
      return
    }

    setUpdating(true)

    try {
      const updated = await updateProtocolStatus(protocol.NetUid)

      if (updated) {
        setLoadState((current) => ({ ...current, protocol: updated }))
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
        setLoadState((current) => ({ ...current, protocol: updated }))
      }
    } catch (assignError) {
      notifications.show({
        color: 'red',
        message: assignError instanceof Error ? assignError.message : t('Не вдалося виконати запит'),
      })
      throw assignError
    } finally {
      setAssigning(false)
    }
  }

  async function saveInvoiceDocuments(invoice: SupplyInvoice, documents: File[]) {
    setSavingInvoiceDocuments(true)

    try {
      const updated = await addDocumentsToSupplyInvoice(invoice, documents)

      if (updated) {
        setLoadState((current) => ({ ...current, protocol: updated }))
      }
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'),
      })
      throw saveError
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
        setLoadState((current) => ({ ...current, protocol: updated }))
      }
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося виконати запит'),
      })
      throw saveError
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
        setLoadState((current) => ({ ...current, protocol: updated }))
      }
    } catch (calculateError) {
      notifications.show({
        color: 'red',
        message: calculateError instanceof Error ? calculateError.message : t('Не вдалося виконати запит'),
      })
      throw calculateError
    } finally {
      setSavingService(false)
    }
  }

  async function assignServiceInvoices(service: MergedService, invoices: SupplyInvoice[]) {
    setSavingService(true)

    try {
      const updated = await assignInvoicesToMergedService(service, invoices)

      if (updated) {
        setLoadState((current) => ({ ...current, protocol: updated }))
      }
    } catch (assignError) {
      notifications.show({
        color: 'red',
        message: assignError instanceof Error ? assignError.message : t('Не вдалося виконати запит'),
      })
      throw assignError
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
        setLoadState((current) => ({ ...current, protocol: updated }))
      }
    } catch (removeError) {
      notifications.show({
        color: 'red',
        message: removeError instanceof Error ? removeError.message : t('Не вдалося виконати запит'),
      })
      throw removeError
    } finally {
      setSavingService(false)
    }
  }

  return {
    assignInvoices, assignServiceInvoices, calculate, canEdit, canEditDeliveryDocuments, changeStatus, error,
    isAssigning, isLoading, isSavingInvoiceDocuments, isSavingService, isUpdating, protocol, removeService,
    saveInvoiceDocuments, saveService,
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
            permissions={{
              canEditAssignments: model.canEdit,
              canEditDeliveryDocuments: model.canEditDeliveryDocuments,
            }}
            protocol={model.protocol}
            status={{
              isAssigning: model.isAssigning,
              isSavingInvoiceDocuments: model.isSavingInvoiceDocuments,
            }}
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
