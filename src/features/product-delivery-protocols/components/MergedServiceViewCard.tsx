import { ActionIcon, Anchor, Alert, Badge, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { CircleAlert, SquarePen, Trash2 } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import { useAuth } from '../../auth/useAuth'
import type { MergedService, SupplyDocument, SupplyPaymentTask } from '../detailTypes'
import { getMergedServiceCalculationLabel } from '../mergedServiceCalculationLabel'
import { LabelValueRow } from './LabelValueRow'
import { formatDate, formatMoney, responsibleName } from './protocolDetailHelpers'

const DELETE_PERMISSION = 'ProductDeliveryProtocols_unified_services_DeleteBtn_PKEY'
const CALCULATE_PERMISSION = 'ProductDeliveryProtocols_unified_services_CalculateBtn_PKEY'
const ASSIGN_INVOICES_PERMISSION = 'ProductDeliveryProtocols_unified_services_AddInvoceBtn_PKEY'
const EDIT_PERMISSION = 'ProductDeliveryProtocols_unified_services_EditBtn_PKEY'

function DocumentLink({ document }: { document: SupplyDocument }) {
  if (!document.DocumentUrl) {
    return (
      <Text size="sm">{document.FileName || '-'}</Text>
    )
  }

  return (
    <Anchor href={upgradeHttpToHttps(document.DocumentUrl)} rel="noreferrer" size="sm" target="_blank">
      {document.FileName || document.DocumentUrl}
    </Anchor>
  )
}

function PaymentTaskBlock({
  currencyCode,
  task,
  title,
}: {
  currencyCode: string
  task?: SupplyPaymentTask | null
  title: string
}) {
  const { t } = useI18n()

  if (!task) {
    return null
  }

  const documents = task.SupplyPaymentTaskDocuments || []

  return (
    <Card withBorder radius="sm" padding="sm">
      <Stack gap={6}>
        <Group justify="space-between" align="center">
          <Text fw={700} size="sm">
            {title}
          </Text>
          {task.Deleted && (
            <Badge color="red" variant="light">
              {t('Видалено')}
            </Badge>
          )}
        </Group>
        <LabelValueRow label={t('Сума')}>{formatMoney(task.GrossPrice, currencyCode)}</LabelValueRow>
        <LabelValueRow label={t('Відповідальний')}>{responsibleName(task.User) || '-'}</LabelValueRow>
        <LabelValueRow label={t('Сплатити до')}>{formatDate(task.PayToDate)}</LabelValueRow>
        <LabelValueRow label={t('Коментар')}>{task.Comment || '-'}</LabelValueRow>
        {documents.length > 0 && (
          <Stack gap={4}>
            <Text c="dimmed" size="sm">
              {t('Файли')}:
            </Text>
            {documents.map((document, index) => (
              <DocumentLink key={document.NetUid || document.Id || index} document={document} />
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}

export function MergedServiceViewCard({
  service,
  canEdit,
  isSaving,
  onAssignInvoices,
  onCalculate,
  onEdit,
  onRemove,
}: {
  canEdit: boolean
  isSaving?: boolean
  onAssignInvoices: () => void
  onCalculate: () => void
  onEdit: () => void
  onRemove: () => void
  service: MergedService
}) {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const currencyCode = service.SupplyOrganizationAgreement?.Currency?.Code || ''
  const invoiceCount = service.SupplyInvoiceMergedServices?.length || 0
  const calculationLabel = getMergedServiceCalculationLabel(service, t)
  const canCalculate = canEdit && hasPermission(CALCULATE_PERMISSION)
  const canAssignInvoices = canEdit && hasPermission(ASSIGN_INVOICES_PERMISSION)
  const canUpdate = canEdit && hasPermission(EDIT_PERMISSION)
  const canRemove = canEdit && hasPermission(DELETE_PERMISSION)
  const hasActions = canCalculate || canAssignInvoices || canUpdate || canRemove

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        {hasActions && (
          <Group justify="flex-end" gap="xs">
            {invoiceCount > 0 && canCalculate && (
              <Button color={CREATE_ACTION_COLOR} disabled={isSaving} size="xs" variant="outline" onClick={onCalculate}>
                {t('Розрахувати')}
              </Button>
            )}
            {canAssignInvoices && (
              <Button color={CREATE_ACTION_COLOR} disabled={isSaving} size="xs" variant="outline" onClick={onAssignInvoices}>
                {t('Додати')} {t('Інвойси')}
              </Button>
            )}
            {canUpdate && (
              <Tooltip label={t('Редагувати')}>
                <ActionIcon color="gray" disabled={isSaving} variant="subtle" onClick={onEdit}>
                  <SquarePen size={18} />
                </ActionIcon>
              </Tooltip>
            )}
            {canRemove && (
              <Tooltip label={t('Видалити')}>
                <ActionIcon color="red" disabled={isSaving} variant="subtle" onClick={onRemove}>
                  <Trash2 size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}

        {!service.IsCalculatedValue && (
          <Alert color="yellow" icon={<CircleAlert size={18} />} variant="light">
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
          <Badge className="app-role-pill" variant="light">
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

        {calculationLabel && (
          <Text c="dimmed" size="sm">
            {calculationLabel}
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

        <PaymentTaskBlock currencyCode={currencyCode} task={service.SupplyPaymentTask} title={t('Платіжна задача')} />
        <PaymentTaskBlock
          currencyCode={currencyCode}
          task={service.AccountingPaymentTask}
          title={`${t('Платіжна задача')} (${t('Бух.')})`}
        />

        <LabelValueRow label={t('Відповідальний')}>{responsibleName(service.User) || '-'}</LabelValueRow>
      </Stack>
    </Card>
  )
}
