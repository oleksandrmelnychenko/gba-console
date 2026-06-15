import { Alert, Button, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { getServiceApprovedInvoices } from '../api/protocolDetailApi'
import type { MergedService, SupplyInvoice } from '../detailTypes'
import {
  getProtocolInvoiceAssignmentKey,
  getSelectedProtocolInvoices,
  mergeProtocolInvoiceAssignmentCandidates,
} from '../protocolInvoiceAssignment'
import { InvoiceSelectList } from './InvoiceSelectList'

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
    <AppDrawer
      opened={opened}
      size="md"
      title={`${t('Додати')} ${t('Інвойси').toLowerCase()}`}
      onClose={() => {
        if (!isSaving) {
          onClose()
        }
      }}
      footer={
        <Button color={CREATE_ACTION_COLOR} disabled={isLoading || isSaving} loading={isSaving} onClick={handleAssign}>
          {t('Зберегти')}
        </Button>
      }
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}
        {isLoading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : (
          <InvoiceSelectList disabled={isSaving} invoices={invoices} selected={selected} onToggle={toggle} />
        )}
      </Stack>
    </AppDrawer>
  )
}
