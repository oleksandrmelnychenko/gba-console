import { Alert, Button, Group, Skeleton, Stack } from '@mantine/core'
import { CircleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getServiceApprovedInvoices } from '../api/protocolDetailApi'
import type { MergedService, SupplyInvoice } from '../detailTypes'
import {
  getProtocolInvoiceAssignmentKey,
  getSelectedProtocolInvoices,
  mergeProtocolInvoiceAssignmentCandidates,
} from '../protocolInvoiceAssignment'
import { InvoiceSelectList } from './InvoiceSelectList'
import './assign-invoices-to-merged-service-panel.css'

export function AssignInvoicesToMergedServicePanel({
  opened,
  service,
  isSaving,
  onAssign,
  onClose,
}: {
  isSaving: boolean
  onAssign: (invoices: SupplyInvoice[]) => Promise<void>
  onClose: () => void
  opened: boolean
  service: MergedService
}) {
  const { t } = useI18n()
  const [invoices, setInvoices] = useValueState<SupplyInvoice[]>([])
  const [selected, setSelected] = useValueState<Record<string, boolean>>({})
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(false)

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false
    const serviceNetId = service.NetUid || ''

    const assignedInvoices = (service.SupplyInvoiceMergedServices || [])
      .map((item) => item.SupplyInvoice)
      .filter((invoice): invoice is SupplyInvoice => Boolean(invoice))

    const initialSelected = assignedInvoices.reduce<Record<string, boolean>>((records, invoice) => {
      const key = getProtocolInvoiceAssignmentKey(invoice)

      if (key) {
        records[key] = true
      }

      return records
    }, {})
    setSelected(initialSelected)

    async function loadInvoices() {
      setLoading(true)
      setError(null)

      try {
        const result = await getServiceApprovedInvoices(serviceNetId)

        if (!cancelled) {
          setInvoices(mergeProtocolInvoiceAssignmentCandidates(result, assignedInvoices))
        }
      } catch (loadError) {
        if (!cancelled) {
          setInvoices([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити інвойси'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInvoices()

    return () => {
      cancelled = true
    }
  }, [opened, service, setError, setInvoices, setLoading, setSelected, t])

  function toggle(invoice: SupplyInvoice) {
    if (isSaving) {
      return
    }

    const key = getProtocolInvoiceAssignmentKey(invoice)

    if (!key) {
      return
    }

    setSelected((records) => ({ ...records, [key]: !records[key] }))
  }

  async function handleAssign() {
    if (isSaving) {
      return
    }

    await onAssign(getSelectedProtocolInvoices(invoices, selected))
  }

  return (
    <AppModal
      centered
      closeOnClickOutside={!isSaving}
      opened={opened}
      size="min(860px, calc(100vw - 32px))"
      title={
        <span className="assign-invoices-title">
          {`${t('Додати')} ${t('Інвойси').toLowerCase()}`}
        </span>
      }
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}
    >
      <Stack className="assign-invoices-modal" gap={12}>
        {error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}
        {isLoading ? (
          <Stack gap="xs">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} height={78} radius={8} />
            ))}
          </Stack>
        ) : (
          <InvoiceSelectList disabled={isSaving} invoices={invoices} selected={selected} onToggle={toggle} />
        )}

        <Group className="assign-invoices-footer" justify="flex-end" gap={8}>
          <Button disabled={isSaving} variant="default" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button
            color={CREATE_ACTION_COLOR}
            disabled={isLoading || isSaving}
            loading={isSaving}
            onClick={handleAssign}
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
