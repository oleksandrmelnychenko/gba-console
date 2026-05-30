import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { getServiceApprovedInvoices } from '../api/protocolDetailApi'
import type { MergedService, SupplyInvoice } from '../detailTypes'
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

    const initialSelected = (service.SupplyInvoiceMergedServices || []).reduce<Record<string, boolean>>(
      (records, item) => {
        if (item.SupplyInvoice?.NetUid) {
          records[item.SupplyInvoice.NetUid] = true
        }

        return records
      },
      {},
    )
    setSelected(initialSelected)

    async function loadInvoices() {
      setLoading(true)
      setError(null)

      try {
        const result = await getServiceApprovedInvoices(serviceNetId)

        if (!cancelled) {
          setInvoices(result)
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
    const netUid = invoice.NetUid || ''
    setSelected((records) => ({ ...records, [netUid]: !records[netUid] }))
  }

  async function handleAssign() {
    await onAssign(invoices.filter((invoice) => invoice.NetUid && selected[invoice.NetUid]))
  }

  return (
    <AppDrawer opened={opened} size="md" title={`${t('Додати')} ${t('Інвойси').toLowerCase()}`} onClose={onClose}>
      <Stack gap="md">
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button color="violet" disabled={isLoading} loading={isSaving} onClick={handleAssign}>
            {t('Зберегти')}
          </Button>
        </Group>
        {isLoading ? (
          <Text c="dimmed" size="sm">
            {t('Завантаження')}
          </Text>
        ) : (
          <InvoiceSelectList invoices={invoices} selected={selected} onToggle={toggle} />
        )}
      </Stack>
    </AppDrawer>
  )
}
