import { ActionIcon, Anchor, Alert, Badge, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconAlertCircle, IconEdit, IconTrash } from '@tabler/icons-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { MergedService, SupplyDocument } from '../detailTypes'
import { LabelValueRow } from './LabelValueRow'
import { formatDate, formatMoney, responsibleName } from './protocolDetailHelpers'

function DocumentLink({ document }: { document: SupplyDocument }) {
  if (!document.DocumentUrl) {
    return (
      <Text size="sm">{document.FileName || '-'}</Text>
    )
  }

  return (
    <Anchor href={document.DocumentUrl} rel="noreferrer" size="sm" target="_blank">
      {document.FileName || document.DocumentUrl}
    </Anchor>
  )
}

export function MergedServiceViewCard({
  service,
  canEdit,
  onAssignInvoices,
  onCalculate,
  onEdit,
  onRemove,
}: {
  canEdit: boolean
  onAssignInvoices: () => void
  onCalculate: () => void
  onEdit: () => void
  onRemove: () => void
  service: MergedService
}) {
  const { t } = useI18n()
  const currencyCode = service.SupplyOrganizationAgreement?.Currency?.Code || ''
  const invoiceCount = service.SupplyInvoiceMergedServices?.length || 0

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        {canEdit && (
          <Group justify="flex-end" gap="xs">
            {invoiceCount > 0 && (
              <Button size="xs" variant="light" onClick={onCalculate}>
                {t('Розрахувати')}
              </Button>
            )}
            <Button size="xs" variant="light" onClick={onAssignInvoices}>
              {t('Додати')} {t('Інвойси')}
            </Button>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon color="gray" variant="subtle" onClick={onEdit}>
                <IconEdit size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити')}>
              <ActionIcon color="red" variant="subtle" onClick={onRemove}>
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}

        {!service.IsCalculatedValue && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} variant="light">
            {t('Сервіс необхідно розрахувати')}
          </Alert>
        )}

        <LabelValueRow label={t('Номер документу')}>{service.ServiceNumber || '-'}</LabelValueRow>
        <LabelValueRow label={t('Постачальник послуг')}>{service.SupplyOrganization?.Name || '-'}</LabelValueRow>
        <LabelValueRow label={t('Тип')}>{service.ConsumableProduct?.Name || '-'}</LabelValueRow>
        <LabelValueRow label={t('Договір')}>
          {service.SupplyOrganizationAgreement?.Name || '-'} ({currencyCode})
        </LabelValueRow>
        <LabelValueRow label={t('Номер інвойса')}>{service.Number || '-'}</LabelValueRow>
        <LabelValueRow label={t('Назва')}>{service.Name || '-'}</LabelValueRow>

        <LabelValueRow label={t('Вартість Брутто')}>{formatMoney(service.GrossPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Вартість Нетто')}>{formatMoney(service.NetPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('ПДВ %')}>{service.VatPercent ?? 0}</LabelValueRow>
        <LabelValueRow label={t('ПДВ')}>{formatMoney(service.Vat, currencyCode)}</LabelValueRow>

        <LabelValueRow label={t('Вартість Брутто (Бух.)')}>
          {formatMoney(service.AccountingGrossPrice, currencyCode)}
        </LabelValueRow>
        <LabelValueRow label={`${t('Вартість Нетто')} (${t('Бух.')})`}>
          {formatMoney(service.AccountingNetPrice, currencyCode)}
        </LabelValueRow>
        <LabelValueRow label={`${t('ПДВ %')} (${t('Бух.')})`}>{service.AccountingVatPercent ?? 0}</LabelValueRow>
        <LabelValueRow label={`${t('ПДВ')} (${t('Бух.')})`}>{formatMoney(service.AccountingVat, currencyCode)}</LabelValueRow>

        {service.IsIncludeAccountingValue && (
          <Badge color="blue" variant="light">
            {t('Бух. вартість включена у цінну брутто')}
          </Badge>
        )}

        <LabelValueRow label={t('Від якої дати')}>{formatDate(service.FromDate)}</LabelValueRow>
        <LabelValueRow label={t('Інвойси')}>{invoiceCount}</LabelValueRow>

        {service.SupplyInformationTask && (
          <>
            <LabelValueRow label={t('Доставка в межах країни')}>
              {formatMoney(service.SupplyInformationTask.GrossPrice, currencyCode)}
            </LabelValueRow>
            <LabelValueRow label={t('Відповідальний за оплату')}>
              {responsibleName(service.SupplyInformationTask.User) || '-'}
            </LabelValueRow>
            <LabelValueRow label={t('Сплатити до')}>{formatDate(service.SupplyInformationTask.FromDate)}</LabelValueRow>
          </>
        )}

        {service.IsCalculatedValue && (
          <Text c="dimmed" size="sm">
            {service.IsAutoCalculatedValue ? t('Розраховано по ціні') : t('Розраховано вручну')}
          </Text>
        )}

        {service.SupplyServiceAccountDocument && (
          <Group gap="xs">
            <Text c="dimmed" size="sm">
              {t('Рахунок')}:
            </Text>
            <DocumentLink document={service.SupplyServiceAccountDocument} />
          </Group>
        )}

        {service.ActProvidingServiceDocument && (
          <Group gap="xs">
            <Text c="dimmed" size="sm">
              {t('Акт надання послуг')}:
            </Text>
            <DocumentLink document={service.ActProvidingServiceDocument} />
          </Group>
        )}

        {service.InvoiceDocuments && service.InvoiceDocuments.length > 0 && (
          <Stack gap={4}>
            <Text c="dimmed" size="sm">
              {t('Інші файли')}:
            </Text>
            {service.InvoiceDocuments.map((document, index) => (
              <DocumentLink key={document.NetUid || index} document={document} />
            ))}
          </Stack>
        )}

        <LabelValueRow label={t('Відповідальний')}>{responsibleName(service.User) || '-'}</LabelValueRow>
      </Stack>
    </Card>
  )
}
