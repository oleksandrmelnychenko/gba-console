import {
  Anchor,
  Badge,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Image,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconPencil, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { getSaleTransporterTypes, getSaleTransportersByType, updateSaleFromData } from '../api/salesUkraineApi'
import type { SalesUkraineSale, SalesUkraineTransporter, SalesUkraineUpdateDataCarrier } from '../types'

const PACKAGING_TYPE = 1
const PACKAGED_TYPE = 2

export function SaleDetailsDrawer({
  sale,
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()

  return (
    <AppDrawer
      opened={Boolean(sale)}
      position="right"
      size="min(1080px, 100vw)"
      title={t('Дані доставки')}
      onClose={onClose}
    >
      {sale && <SaleDetailsContent key={sale.NetUid || sale.Id} sale={sale} onSaved={onSaved} />}
    </AppDrawer>
  )
}

function SaleDetailsContent({ sale, onSaved }: { onSaved: () => void; sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const lifecycleType = sale.BaseLifeCycleStatus?.SaleLifeCycleType
  const showShipmentDate = lifecycleType === PACKAGING_TYPE || lifecycleType === PACKAGED_TYPE

  const [isEditMode, setEditMode] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [transporters, setTransporters] = useState<SalesUkraineTransporter[]>([])

  const [transporterId, setTransporterId] = useState(() => getTransporterValue(sale.Transporter))
  const [shipmentDate, setShipmentDate] = useState(() => toDateInput(sale.ShipmentDate))
  const [ttn, setTtn] = useState(sale.TTN || '')
  const [city, setCity] = useState(sale.DeliveryRecipientAddress?.City || '')
  const [department, setDepartment] = useState(sale.DeliveryRecipientAddress?.Department || '')
  const [recipientName, setRecipientName] = useState(sale.DeliveryRecipient?.FullName || '')
  const [mobilePhone, setMobilePhone] = useState(sale.DeliveryRecipient?.MobilePhone || '')
  const [comment, setComment] = useState(sale.Comment || '')
  const [isCashOnDelivery, setCashOnDelivery] = useState(Boolean(sale.IsCashOnDelivery))
  const [cashOnDeliveryAmount, setCashOnDeliveryAmount] = useState<number | string>(sale.CashOnDeliveryAmount ?? '')
  const [hasDocuments, setHasDocuments] = useState(Boolean(sale.HasDocuments))
  const [hasOwnTtn, setHasOwnTtn] = useState(Boolean(sale.CustomersOwnTtn))
  const [ownTtnNumber, setOwnTtnNumber] = useState(sale.CustomersOwnTtn?.Number || '')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const originalCity = sale.DeliveryRecipientAddress?.City || ''
  const originalDepartment = sale.DeliveryRecipientAddress?.Department || ''
  const originalName = sale.DeliveryRecipient?.FullName || ''
  const originalPhone = sale.DeliveryRecipient?.MobilePhone || ''
  const isChangedAddress = city !== originalCity || department !== originalDepartment
  const isChangedRecipient = recipientName !== originalName || mobilePhone !== originalPhone

  const selectedTransporter = transporters.find((item) => getTransporterValue(item) === transporterId) || sale.Transporter

  async function enterEdit() {
    setEditMode(true)

    if (transporters.length > 0) {
      return
    }

    try {
      const types = await getSaleTransporterTypes()
      const firstNetUid = types[0]?.NetUid

      if (firstNetUid) {
        setTransporters(await getSaleTransportersByType(firstNetUid))
      }
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося завантажити перевізників') })
    }
  }

  function cancelEdit() {
    setEditMode(false)
    setTransporterId(getTransporterValue(sale.Transporter))
    setShipmentDate(toDateInput(sale.ShipmentDate))
    setTtn(sale.TTN || '')
    setCity(originalCity)
    setDepartment(originalDepartment)
    setRecipientName(originalName)
    setMobilePhone(originalPhone)
    setComment(sale.Comment || '')
    setCashOnDelivery(Boolean(sale.IsCashOnDelivery))
    setCashOnDeliveryAmount(sale.CashOnDeliveryAmount ?? '')
    setHasDocuments(Boolean(sale.HasDocuments))
    setHasOwnTtn(Boolean(sale.CustomersOwnTtn))
    setOwnTtnNumber(sale.CustomersOwnTtn?.Number || '')
    setUploadedFile(null)
  }

  async function save() {
    setSaving(true)

    const payload: SalesUkraineSale = { ...sale }

    if (sale.IsPrinted) {
      payload.TTN = ttn
    }

    if (!hasOwnTtn) {
      payload.CustomersOwnTtnId = 0
    }

    payload.Transporter = selectedTransporter
    payload.Comment = comment
    payload.IsCashOnDelivery = isCashOnDelivery
    payload.CashOnDeliveryAmount = isCashOnDelivery ? Number(cashOnDeliveryAmount) || 0 : 0
    payload.HasDocuments = hasDocuments
    payload.DeliveryRecipient = {
      ...(sale.DeliveryRecipient || {}),
      FullName: recipientName,
      MobilePhone: mobilePhone,
      ...(isChangedRecipient ? { Id: 0 } : {}),
    }
    payload.DeliveryRecipientAddress = {
      ...(sale.DeliveryRecipientAddress || {}),
      City: city,
      Department: department,
      ...(isChangedAddress ? { Id: 0 } : {}),
    }

    if (showShipmentDate && shipmentDate) {
      payload.ShipmentDate = new Date(shipmentDate).toISOString()
    }

    if (hasOwnTtn) {
      payload.CustomersOwnTtn = { ...(sale.CustomersOwnTtn || {}), Number: ownTtnNumber }
    }

    try {
      await updateSaleFromData(payload, uploadedFile)
      notifications.show({ color: 'green', message: t('Дані доставки збережено') })
      onSaved()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося зберегти дані доставки') })
    } finally {
      setSaving(false)
    }
  }

  const transporterData = transporters
    .filter((item) => item.Name)
    .map((item) => ({ label: item.Name || '', value: getTransporterValue(item) }))

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Text fw={600}>{displayValue(sale.SaleNumber?.Value)}</Text>
          <Text size="sm" c="dimmed">
            {displayValue(sale.ClientAgreement?.Client?.FullName)}
          </Text>
        </Group>
        {!sale.IsSent && !isEditMode && (
          <Button leftSection={<IconPencil size={16} />} variant="light" onClick={enterEdit}>
            {t('Редагувати')}
          </Button>
        )}
        {sale.IsSent && (
          <Badge color="teal" variant="light">
            {t('Продаж проведено')}
          </Badge>
        )}
      </Group>

      <Divider />

      {isEditMode ? (
        <Stack gap="sm">
          <Select
            clearable
            searchable
            data={transporterData}
            label={t('Перевізник')}
            placeholder={t('Оберіть перевізника')}
            value={transporterId || null}
            onChange={(value) => setTransporterId(value || '')}
          />
          {showShipmentDate && (
            <TextInput
              label={t('Дата відгрузки')}
              type="date"
              value={shipmentDate}
              onChange={(event) => setShipmentDate(event.currentTarget.value)}
            />
          )}
          {sale.IsPrinted && (
            <TextInput label={t('Номер декларації')} value={ttn} onChange={(event) => setTtn(event.currentTarget.value)} />
          )}
          {isChangedAddress && (
            <Text c="orange" size="xs">
              {t('При редагуванні буде створено нову адресу одержувача')}
            </Text>
          )}
          <Group grow>
            <TextInput label={t('Місто')} value={city} onChange={(event) => setCity(event.currentTarget.value)} />
            <TextInput
              label={t('Відділення')}
              value={department}
              onChange={(event) => setDepartment(event.currentTarget.value)}
            />
          </Group>
          {isChangedRecipient && (
            <Text c="orange" size="xs">
              {t('При редагуванні буде створено нового одержувача')}
            </Text>
          )}
          <Group grow>
            <TextInput
              label={t('Отримувач товару')}
              value={recipientName}
              onChange={(event) => setRecipientName(event.currentTarget.value)}
            />
            <TextInput
              label={t('Мобільний телефон')}
              value={mobilePhone}
              onChange={(event) => setMobilePhone(event.currentTarget.value)}
            />
          </Group>
          <Textarea
            autosize
            label={t('Коментар')}
            minRows={2}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
          />
          <Checkbox
            checked={isCashOnDelivery}
            label={t('Наложений платіж')}
            onChange={(event) => setCashOnDelivery(event.currentTarget.checked)}
          />
          {isCashOnDelivery && (
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              label={t('Рекомендована покупцем сума')}
              value={cashOnDeliveryAmount}
              onChange={setCashOnDeliveryAmount}
            />
          )}
          <Checkbox
            checked={hasDocuments}
            label={t('Є документи')}
            onChange={(event) => setHasDocuments(event.currentTarget.checked)}
          />
          <Checkbox
            checked={hasOwnTtn}
            label={t('Власне ТТН')}
            onChange={(event) => setHasOwnTtn(event.currentTarget.checked)}
          />
          {hasOwnTtn && (
            <Group grow align="end">
              <TextInput
                label={t('Номер ТТН')}
                value={ownTtnNumber}
                onChange={(event) => setOwnTtnNumber(event.currentTarget.value)}
              />
              <FileInput
                clearable
                label={t('Завантажити ТТН')}
                placeholder={t('Оберіть файл')}
                value={uploadedFile}
                onChange={setUploadedFile}
              />
            </Group>
          )}
          <Group justify="flex-end">
            <Button color="gray" disabled={isSaving} leftSection={<IconX size={16} />} variant="subtle" onClick={cancelEdit}>
              {t('Скасувати')}
            </Button>
            <Button leftSection={<IconCheck size={16} />} loading={isSaving} onClick={save}>
              {t('Зберегти')}
            </Button>
          </Group>
        </Stack>
      ) : (
        <DetailsView sale={sale} />
      )}

      <Divider />

      <CarrierHistory entries={Array.isArray(sale.UpdateDataCarrier) ? sale.UpdateDataCarrier : []} />
    </Stack>
  )
}

function DetailsView({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const lifecycleType = sale.BaseLifeCycleStatus?.SaleLifeCycleType
  const showShipmentDate = lifecycleType === PACKAGING_TYPE || lifecycleType === PACKAGED_TYPE

  return (
    <Stack gap={6}>
      <Group gap="xs">
        {sale.Transporter?.ImageUrl && <Image alt="" h={20} src={toSecure(sale.Transporter.ImageUrl)} w={20} />}
        <Text fw={600}>{displayValue(sale.Transporter?.Name || sale.Transporter?.Title)}</Text>
      </Group>
      <Row label={t('Місто')} value={sale.DeliveryRecipientAddress?.City} />
      <Row label={t('Відділення')} value={sale.DeliveryRecipientAddress?.Department} />
      {showShipmentDate && <Row label={t('Дата відгрузки')} value={formatDate(sale.ShipmentDate)} />}
      {sale.IsPrinted && <Row label={t('Номер декларації')} value={sale.TTN} />}
      <Row label={t('Отримувач товару')} value={sale.DeliveryRecipient?.FullName} />
      <Row label={t('Мобільний телефон')} value={sale.DeliveryRecipient?.MobilePhone} />
      <Row label={t('Коментар')} value={sale.Comment} />
      <Row label={t('Наложений платіж')} value={sale.IsCashOnDelivery ? t('Так') : t('Ні')} />
      {sale.IsCashOnDelivery && <Row label={t('Сума накладеного платежу')} value={sale.CashOnDeliveryAmount} />}
      <Row label={t('Є документи')} value={sale.HasDocuments ? t('Так') : t('Ні')} />
      {sale.CustomersOwnTtn?.Number && <Row label={t('Власне ТТН')} value={sale.CustomersOwnTtn.Number} />}
      {sale.CustomersOwnTtn?.TtnPDFPath && (
        <Anchor href={toSecure(sale.CustomersOwnTtn.TtnPDFPath)} target="_blank" rel="noopener noreferrer">
          {t('Завантажити ТТН')}
        </Anchor>
      )}
    </Stack>
  )
}

function CarrierHistory({ entries }: { entries: SalesUkraineUpdateDataCarrier[] }) {
  const { t } = useI18n()

  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('Історія змін відсутня')}
      </Text>
    )
  }

  const rows: Array<{ label: string; render: (entry: SalesUkraineUpdateDataCarrier) => string }> = [
    { label: t('Перевізник'), render: (entry) => entry.Transporter?.Name || '' },
    { label: t('Місто'), render: (entry) => entry.City || '' },
    { label: t('Відділення'), render: (entry) => entry.Department || '' },
    { label: t('Дата відгрузки'), render: (entry) => formatDate(entry.ShipmentDate) },
    { label: t('Отримувач товару'), render: (entry) => entry.FullName || '' },
    { label: t('Мобільний телефон'), render: (entry) => entry.MobilePhone || '' },
    { label: t('Коментар'), render: (entry) => entry.Comment || '' },
    { label: t('Наложений платіж'), render: (entry) => (entry.IsCashOnDelivery ? t('Так') : t('Ні')) },
    { label: t('Сума накладеного платежу'), render: (entry) => formatNumber(entry.CashOnDeliveryAmount) },
    { label: t('Є документи'), render: (entry) => (entry.HasDocument ? t('Так') : t('Ні')) },
    { label: t('Власне ТТН'), render: (entry) => entry.Number || '' },
    { label: t('Відповідальний'), render: (entry) => getUserName(entry) },
  ]

  return (
    <Stack gap="xs">
      <Text fw={600}>{t('Історія змін')}</Text>
      <ScrollArea type="auto">
        <Table withColumnBorders withRowBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              {entries.map((entry) => (
                <Table.Th key={entry.NetUid || entry.Id} style={{ whiteSpace: 'nowrap' }}>
                  {formatDateTime(entry.Created)}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.label}>
                <Table.Td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{row.label}</Table.Td>
                {entries.map((entry, index) => {
                  const value = row.render(entry)
                  const previous = index > 0 ? row.render(entries[index - 1]) : value
                  const changed = index > 0 && value !== previous

                  return (
                    <Table.Td
                      key={`${row.label}-${entry.NetUid || entry.Id || index}`}
                      style={{ whiteSpace: 'nowrap', color: changed ? 'var(--mantine-color-orange-7)' : undefined }}
                    >
                      {value || '—'}
                    </Table.Td>
                  )
                })}
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{t('Документ')}</Table.Td>
              {entries.map((entry, index) => (
                <Table.Td key={`doc-${entry.NetUid || entry.Id || index}`}>
                  {entry.TtnPDFPath ? (
                    <Anchor href={toSecure(entry.TtnPDFPath)} target="_blank" rel="noopener noreferrer">
                      {t('Завантажити')}
                    </Anchor>
                  ) : (
                    '—'
                  )}
                </Table.Td>
              ))}
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  )
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <Group justify="space-between" align="flex-start" gap="lg" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right">
        {displayValue(value)}
      </Text>
    </Group>
  )
}

function getTransporterValue(transporter?: SalesUkraineTransporter | null): string {
  if (!transporter) {
    return ''
  }

  return String(transporter.Id ?? transporter.NetUid ?? '')
}

function getUserName(entry: SalesUkraineUpdateDataCarrier): string {
  const user = entry.User

  return user ? [user.FirstName, user.LastName].filter(Boolean).join(' ').trim() : ''
}

function toDateInput(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function formatDate(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('uk-UA')
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('uk-UA')
}

function formatNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function toSecure(url: string): string {
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

function displayValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }

  if (typeof value === 'string') {
    return value.trim() || '—'
  }

  return '—'
}
