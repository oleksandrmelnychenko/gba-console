import { ActionIcon, Anchor, Badge, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import type { MergedService, SupplyDocument, SupplyPaymentTask } from '../types'
import { formatDate, formatMoney, responsibleName } from './helpers'

function DocumentLink({ document }: { document: SupplyDocument }) {
  if (!document.DocumentUrl) {
    return <Text size="sm">{document.FileName || '-'}</Text>
  }

  return (
    <Anchor href={upgradeHttpToHttps(document.DocumentUrl)} rel="noreferrer" size="sm" target="_blank">
      {document.FileName || document.DocumentUrl}
    </Anchor>
  )
}

function LabelValueRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text c="dimmed" size="sm">
        {label}
      </Text>
      <Text fw={500} size="sm" ta="right">
        {children}
      </Text>
    </Group>
  )
}

function PaymentTaskRow({
  isAccounting,
  onRemove,
  task,
}: {
  isAccounting?: boolean
  onRemove: () => void
  task: SupplyPaymentTask
}) {
  const { t } = useI18n()

  return (
    <Card withBorder radius="sm" padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Text fw={600} size="sm">
            {t('Платіжна задача')}
            {isAccounting ? ` (${t('Бух.')})` : ''}
          </Text>
          <Text size="sm">{responsibleName(task.User) || '-'}</Text>
          <Text c="dimmed" size="xs">
            {t('Сплатити до')}: {formatDate(task.PayToDate)}
          </Text>
          {task.Comment && (
            <Text c="dimmed" size="xs">
              {task.Comment}
            </Text>
          )}
        </Stack>
        <Tooltip label={t('Видалити')}>
          <ActionIcon color="red" variant="subtle" onClick={onRemove}>
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Card>
  )
}

export function MergedServiceCard({
  onRemovePaymentTask,
  onRemoveService,
  service,
}: {
  onRemovePaymentTask: (service: MergedService, task: SupplyPaymentTask) => void
  onRemoveService: (service: MergedService) => void
  service: MergedService
}) {
  const { t } = useI18n()
  const currencyCode = service.SupplyOrganizationAgreement?.Currency?.Code || ''
  const invoiceDocuments = (service.InvoiceDocuments || []).filter((document) => !document.Deleted)

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={700}>{t('Об’єднаний сервіс')}</Text>
          <Tooltip label={t('Видалити')}>
            <ActionIcon color="red" variant="subtle" onClick={() => onRemoveService(service)}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <LabelValueRow label={t('Номер інвойса')}>{service.Number || '-'}</LabelValueRow>
        <LabelValueRow label={t('Постачальник послуг')}>{service.SupplyOrganization?.Name || '-'}</LabelValueRow>
        <LabelValueRow label={t('Договір')}>
          {service.SupplyOrganizationAgreement?.Name || '-'} ({currencyCode})
        </LabelValueRow>
        <LabelValueRow label={t('Тип')}>{service.ConsumableProduct?.Name || '-'}</LabelValueRow>
        <LabelValueRow label={t('Назва')}>{service.Name || '-'}</LabelValueRow>

        <LabelValueRow label={t('Вартість Брутто')}>{formatMoney(service.GrossPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Вартість Нетто')}>{formatMoney(service.NetPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('ПДВ %')}>{service.VatPercent ?? 0}</LabelValueRow>
        <LabelValueRow label={t('ПДВ')}>{formatMoney(service.Vat, currencyCode)}</LabelValueRow>

        <LabelValueRow label={`${t('Вартість Брутто')} (${t('Бух.')})`}>
          {formatMoney(service.AccountingGrossPrice, currencyCode)}
        </LabelValueRow>
        <LabelValueRow label={`${t('Вартість Нетто')} (${t('Бух.')})`}>
          {formatMoney(service.AccountingNetPrice, currencyCode)}
        </LabelValueRow>
        <LabelValueRow label={`${t('ПДВ %')} (${t('Бух.')})`}>{service.AccountingVatPercent ?? 0}</LabelValueRow>
        <LabelValueRow label={`${t('ПДВ')} (${t('Бух.')})`}>{formatMoney(service.AccountingVat, currencyCode)}</LabelValueRow>

        {service.IsIncludeAccountingValue && (
          <Badge color="violet" variant="light">
            {t('Бух. вартість включена у цінну брутто')}
          </Badge>
        )}

        <LabelValueRow label={t('Від якої дати')}>{formatDate(service.FromDate)}</LabelValueRow>

        {service.SupplyInformationTask && (
          <LabelValueRow label={t('Доставка в межах країни')}>
            {formatMoney(service.SupplyInformationTask.GrossPrice, currencyCode)}
          </LabelValueRow>
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

        {invoiceDocuments.length > 0 && (
          <Stack gap={4}>
            <Text c="dimmed" size="sm">
              {t('Інші файли')}:
            </Text>
            {invoiceDocuments.map((document, index) => (
              <DocumentLink key={document.NetUid || index} document={document} />
            ))}
          </Stack>
        )}

        {service.SupplyPaymentTask && (service.SupplyPaymentTask.Id || 0) > 0 && !service.SupplyPaymentTask.Deleted && (
          <PaymentTaskRow
            task={service.SupplyPaymentTask}
            onRemove={() => onRemovePaymentTask(service, service.SupplyPaymentTask as SupplyPaymentTask)}
          />
        )}
        {service.AccountingPaymentTask &&
          (service.AccountingPaymentTask.Id || 0) > 0 &&
          !service.AccountingPaymentTask.Deleted && (
            <PaymentTaskRow
              isAccounting
              task={service.AccountingPaymentTask}
              onRemove={() => onRemovePaymentTask(service, service.AccountingPaymentTask as SupplyPaymentTask)}
            />
          )}

        <LabelValueRow label={t('Відповідальний')}>{responsibleName(service.User) || '-'}</LabelValueRow>
      </Stack>
    </Card>
  )
}
