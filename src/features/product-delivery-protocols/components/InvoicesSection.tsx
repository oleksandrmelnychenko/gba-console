import { Alert, Button, Card, Group, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { getApprovedInvoices } from '../api/protocolDetailApi'
import type { ProtocolDetail, SupplyInvoice } from '../detailTypes'
import { InvoiceSelectList } from './InvoiceSelectList'
import { LabelValueRow } from './LabelValueRow'
import { formatDateTime, formatMoney } from './protocolDetailHelpers'

function InvoiceViewCard({ invoice }: { invoice: SupplyInvoice }) {
  const { t } = useI18n()
  const currencyCode = invoice.SupplyOrder?.ClientAgreement?.Agreement?.Currency?.Code || ''
  const totalNetPrice =
    (invoice.TotalNetPrice || 0) + (invoice.DeliveryAmount || 0) - (invoice.DiscountAmount || 0)

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <LabelValueRow label={t('Номер документу')}>{invoice.ServiceNumber || '-'}</LabelValueRow>
        <LabelValueRow label={t('Номер інвойса')}>{invoice.Number || '-'}</LabelValueRow>
        <LabelValueRow label={t('Дата інвойса')}>{formatDateTime(invoice.DateFrom)}</LabelValueRow>
        <LabelValueRow label={t('Постачальник')}>{invoice.SupplyOrder?.Client?.FullName || '-'}</LabelValueRow>
        <LabelValueRow label={t('Заг. вартість нетто')}>{formatMoney(invoice.TotalNetPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Сума доставки')}>{formatMoney(invoice.DeliveryAmount, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Сума знижки')}>{formatMoney(invoice.DiscountAmount, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Кінцева вартість Нетто')}>{formatMoney(totalNetPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Витрати')}>{formatMoney(invoice.TotalSpending, 'EUR')}</LabelValueRow>
        <LabelValueRow label={`${t('Витрати')} (${t('Бух.')})`}>
          {formatMoney(invoice.AccountingTotalSpending, 'EUR')}
        </LabelValueRow>
      </Stack>
    </Card>
  )
}

function AssignInvoicesDrawer({
  opened,
  protocol,
  isSaving,
  onAssign,
  onClose,
}: {
  isSaving: boolean
  onAssign: (invoices: SupplyInvoice[]) => void
  onClose: () => void
  opened: boolean
  protocol: ProtocolDetail
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
    const organizationNetId = protocol.Organization?.NetUid || ''
    const protocolNetId = protocol.NetUid || ''

    const initialSelected = (protocol.SupplyInvoices || []).reduce<Record<string, boolean>>((records, invoice) => {
      if (invoice.NetUid) {
        records[invoice.NetUid] = true
      }

      return records
    }, {})
    setSelected(initialSelected)

    async function loadInvoices() {
      setLoading(true)
      setError(null)

      try {
        const result = await getApprovedInvoices(organizationNetId, protocol.TransportationType ?? 0, protocolNetId)

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
  }, [opened, protocol, setError, setInvoices, setLoading, setSelected, t])

  function toggle(invoice: SupplyInvoice) {
    const netUid = invoice.NetUid || ''
    setSelected((records) => ({ ...records, [netUid]: !records[netUid] }))
  }

  function handleAssign() {
    onAssign(invoices.filter((invoice) => invoice.NetUid && selected[invoice.NetUid]))
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

export function InvoicesSection({
  protocol,
  canEdit,
  isAssigning,
  onAssignInvoices,
}: {
  canEdit: boolean
  isAssigning: boolean
  onAssignInvoices: (invoices: SupplyInvoice[]) => Promise<void>
  protocol: ProtocolDetail
}) {
  const { t } = useI18n()
  const [drawerOpened, setDrawerOpened] = useValueState(false)
  const invoices = protocol.SupplyInvoices || []

  async function handleAssign(selectedInvoices: SupplyInvoice[]) {
    await onAssignInvoices(selectedInvoices)
    setDrawerOpened(false)
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={700}>{t('Інвойси')}</Text>
        {canEdit && (
          <Button color="violet" variant="light" onClick={() => setDrawerOpened(true)}>
            {t('Управління інвойсами')}
          </Button>
        )}
      </Group>

      {invoices.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('Інвойсів не знайдено')}
        </Text>
      ) : (
        <Stack gap="md">
          {invoices.map((invoice) => (
            <InvoiceViewCard key={invoice.NetUid} invoice={invoice} />
          ))}
        </Stack>
      )}

      <AssignInvoicesDrawer
        isSaving={isAssigning}
        opened={drawerOpened}
        protocol={protocol}
        onAssign={handleAssign}
        onClose={() => setDrawerOpened(false)}
      />
    </Stack>
  )
}
