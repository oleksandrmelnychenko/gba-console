import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { upgradeHttpToHttps } from '../../../shared/url/upgradeHttpToHttps'
import type { MergedService, ProtocolUser, SupplyDocument, SupplyPaymentTask } from '../types'
import { formatDate, formatMoney, fromDateInput, responsibleName, toDateInput } from './helpers'
import type { MergedServicePermissions } from './MergedServicesSection'

type AddPaymentTaskValues = {
  comment: string
  payToDate: Date | null
  responsible: ProtocolUser | null
}

type SelectOption = {
  label: string
  value: string
}

function toProtocolUserOptions(users: ProtocolUser[]): SelectOption[] {
  const options: SelectOption[] = []

  for (const user of users) {
    if (!user.NetUid) {
      continue
    }

    options.push({ label: responsibleName(user) || user.FullName || '', value: user.NetUid })
  }

  return options
}

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
  canRemove,
  isAccounting,
  onRemove,
  task,
}: {
  canRemove: boolean
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
        {canRemove && (
          <Tooltip label={t('Видалити')}>
            <ActionIcon color="red" variant="subtle" onClick={onRemove}>
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Card>
  )
}

function hasPersistedPaymentTask(task?: SupplyPaymentTask | null): boolean {
  return Boolean(task && (task.Id || task.NetUid) && !task.Deleted)
}

function AddPaymentTaskForm({
  isAccounting,
  isSaving,
  onCancel,
  onSubmit,
  users,
}: {
  isAccounting?: boolean
  isSaving: boolean
  onCancel: () => void
  onSubmit: (values: AddPaymentTaskValues) => Promise<void>
  users: ProtocolUser[]
}) {
  const { t } = useI18n()
  const [responsible, setResponsible] = useValueState<ProtocolUser | null>(null)
  const [payToDate, setPayToDate] = useValueState<Date | null>(new Date())
  const [comment, setComment] = useValueState('')

  const userOptions = toProtocolUserOptions(users)

  return (
    <Card withBorder radius="sm" padding="sm">
      <Stack gap="sm">
        <Text fw={600} size="sm">
          {t('Створити платіжну задачу')}
          {isAccounting ? ` (${t('Бух.')})` : ''}
        </Text>
        <TextInput
          label={t('Сплатити до')}
          type="date"
          value={toDateInput(payToDate)}
          onChange={(event) => setPayToDate(fromDateInput(event.currentTarget.value))}
        />
        <Select
          clearable
          data={userOptions}
          label={t('Відповідальний за оплату')}
          searchable
          value={responsible?.NetUid || null}
          onChange={(netUid) => setResponsible(users.find((item) => item.NetUid === netUid) || null)}
        />
        <Textarea label={t('Коментар')} value={comment} onChange={(event) => setComment(event.currentTarget.value)} />
        <Group justify="flex-end" gap="sm">
          <Button color="gray" disabled={isSaving} variant="light" onClick={onCancel}>
            {t('Скасувати')}
          </Button>
          <Button
            color="violet"
            loading={isSaving}
            onClick={() => {
              void onSubmit({ comment, payToDate, responsible })
            }}
          >
            {t('Зберегти')}
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

export function MergedServiceCard({
  isSaving,
  onAddPaymentTask,
  onRemovePaymentTask,
  onRemoveService,
  permissions,
  service,
  users,
}: {
  isSaving: boolean
  onAddPaymentTask: (service: MergedService, values: AddPaymentTaskValues, isAccounting: boolean) => Promise<void>
  onRemovePaymentTask: (service: MergedService, task: SupplyPaymentTask) => void
  onRemoveService: (service: MergedService) => void
  permissions: MergedServicePermissions
  service: MergedService
  users: ProtocolUser[]
}) {
  const { t } = useI18n()
  const currencyCode = service.SupplyOrganizationAgreement?.Currency?.Code || ''
  const invoiceDocuments = (service.InvoiceDocuments || []).filter((document) => !document.Deleted)
  const [isAddOpen, setAddOpen] = useValueState(false)
  const [isAddAccountingOpen, setAddAccountingOpen] = useValueState(false)

  const hasPaymentTask = hasPersistedPaymentTask(service.SupplyPaymentTask)
  const hasAccountingPaymentTask = hasPersistedPaymentTask(service.AccountingPaymentTask)

  function handleAdd(isAccounting: boolean) {
    return async (values: AddPaymentTaskValues) => {
      try {
        await onAddPaymentTask(service, values, isAccounting)
        setAddOpen(false)
        setAddAccountingOpen(false)
      } catch {
        // Parent renders the action error; keep the form open on failure.
      }
    }
  }

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={700}>{t('Об’єднаний сервіс')}</Text>
          {permissions.canRemoveService && (
            <Tooltip label={t('Видалити')}>
              <ActionIcon color="red" variant="subtle" onClick={() => onRemoveService(service)}>
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          )}
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

        {hasPaymentTask && (
          <PaymentTaskRow
            canRemove={permissions.canRemovePaymentTask}
            task={service.SupplyPaymentTask as SupplyPaymentTask}
            onRemove={() => onRemovePaymentTask(service, service.SupplyPaymentTask as SupplyPaymentTask)}
          />
        )}
        {hasAccountingPaymentTask && (
          <PaymentTaskRow
            canRemove={permissions.canRemovePaymentTask}
            isAccounting
            task={service.AccountingPaymentTask as SupplyPaymentTask}
            onRemove={() => onRemovePaymentTask(service, service.AccountingPaymentTask as SupplyPaymentTask)}
          />
        )}

        {permissions.canCreatePaymentTask &&
          !hasPaymentTask &&
          !isAddAccountingOpen &&
          (isAddOpen ? (
            <AddPaymentTaskForm
              isSaving={isSaving}
              users={users}
              onCancel={() => setAddOpen(false)}
              onSubmit={handleAdd(false)}
            />
          ) : (
            <Button
              color="violet"
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={() => setAddOpen(true)}
            >
              {t('Створити платіжну задачу')}
            </Button>
          ))}

        {permissions.canCreatePaymentTask &&
          !hasAccountingPaymentTask &&
          !isAddOpen &&
          (isAddAccountingOpen ? (
            <AddPaymentTaskForm
              isAccounting
              isSaving={isSaving}
              users={users}
              onCancel={() => setAddAccountingOpen(false)}
              onSubmit={handleAdd(true)}
            />
          ) : (
            <Button
              color="violet"
              leftSection={<IconPlus size={16} />}
              variant="light"
              onClick={() => setAddAccountingOpen(true)}
            >
              {`${t('Створити платіжну задачу')} (${t('Бух.')})`}
            </Button>
          ))}

        <LabelValueRow label={t('Відповідальний')}>{responsibleName(service.User) || '-'}</LabelValueRow>
      </Stack>
    </Card>
  )
}
