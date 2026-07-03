import {
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
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
import { IconCheck, IconPencil, IconTruckDelivery, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { getSaleTransporterTypes, getSaleTransportersByType, updateSaleFromData } from '../api/salesUkraineApi'
import { getSaleLifecycleStatusKey } from '../saleStatus'
import type { SalesUkraineSale, SalesUkraineTransporter, SalesUkraineUpdateDataCarrier } from '../types'

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
      title={t('Перевізник')}
      onClose={onClose}
    >
      {sale && <SaleDetailsContent key={sale.NetUid || sale.Id} sale={sale} onSaved={onSaved} />}
    </AppDrawer>
  )
}

function SaleDetailsContent({ sale, onSaved }: { onSaved: () => void; sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const lifecycleStatusKey = getSaleLifecycleStatusKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name)
  const showShipmentDate = lifecycleStatusKey === 'Packaging' || lifecycleStatusKey === 'Packaged'

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

  // Live "current data" snapshot for the right-most history column (diffs against the last saved entry).
  const currentCarrier = {
    CashOnDeliveryAmount: isCashOnDelivery ? Number(cashOnDeliveryAmount) || 0 : 0,
    City: city,
    Comment: comment,
    Department: department,
    FullName: recipientName,
    HasDocument: hasDocuments,
    IsCashOnDelivery: isCashOnDelivery,
    MobilePhone: mobilePhone,
    Number: hasOwnTtn ? ownTtnNumber : '',
    ShipmentDate: shipmentDate ? new Date(shipmentDate).toISOString() : sale.ShipmentDate,
    Transporter: selectedTransporter,
    TtnPDFPath: sale.CustomersOwnTtn?.TtnPDFPath,
    // Responsible for the "Актуальні дані" column comes from the sale's UpdateUser (legacy parity),
    // not the carrier snapshot — otherwise the cell is empty and shows as a spurious change.
    User: sale.UpdateUser,
  } as SalesUkraineUpdateDataCarrier

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

    if (isChangedAddress) {
      payload.DeliveryRecipientAddressId = 0
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

  const transporterData = transporters.reduce<Array<{ label: string; value: string }>>((acc, item) => {
    if (item.Name) {
      acc.push({ label: item.Name || '', value: getTransporterValue(item) })
    }
    return acc
  }, [])

  return (
    <Stack gap="md">
      {/* Single panel like the legacy: data/form on the left (client info sits under the transporter,
          edit button at the bottom), the change history table on the right. */}
      <Box style={{ alignItems: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 'var(--mantine-spacing-xl)' }}>
        <Box style={{ flex: '0 0 360px', maxWidth: '100%', minWidth: 0 }}>
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
          <ClientInfo sale={sale} />
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

          {/* Edit button at the bottom of the left column, under "Завантажити ТТН" (legacy order). */}
          {!sale.IsSent && !isEditMode && (
            <Button leftSection={<IconPencil size={16} />} mt="md" variant="light" onClick={enterEdit}>
              {t('Редагувати')}
            </Button>
          )}
          {sale.IsSent && (
            <Badge color="teal" mt="md" variant="light">
              {t('Продаж проведено')}
            </Badge>
          )}
        </Box>

        {/* RIGHT: change history table beside the data, as in the legacy panel. */}
        <Box style={{ flex: '1 1 520px', minWidth: 0 }}>
          <CarrierHistory current={currentCarrier} entries={Array.isArray(sale.UpdateDataCarrier) ? sale.UpdateDataCarrier : []} />
        </Box>
      </Box>
    </Stack>
  )
}

function DetailsView({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()
  const lifecycleStatusKey = getSaleLifecycleStatusKey(sale.BaseLifeCycleStatus?.SaleLifeCycleType ?? sale.BaseLifeCycleStatus?.Name)
  const showShipmentDate = lifecycleStatusKey === 'Packaging' || lifecycleStatusKey === 'Packaged'

  // Highlight fields that differ from the last recorded change (sd_error in the legacy panel).
  const entries = Array.isArray(sale.UpdateDataCarrier) ? sale.UpdateDataCarrier : []
  const last = entries.length > 0 ? entries[entries.length - 1] : null
  const changed = (current: unknown, previous: unknown) => last != null && normalizeCompare(current) !== normalizeCompare(previous)

  return (
    <Stack gap={6}>
      <Group gap="xs">
        {sale.Transporter?.ImageUrl ? (
          <Image alt="" h={20} src={toSecure(sale.Transporter.ImageUrl)} w={20} />
        ) : (
          <IconTruckDelivery size={20} />
        )}
        <Text fw={600} c={changed(sale.Transporter?.Name, last?.Transporter?.Name) ? 'orange.7' : undefined}>
          {displayValue(sale.Transporter?.Name || sale.Transporter?.Title)}
        </Text>
      </Group>
      <ClientInfo sale={sale} />
      <Row changed={changed(sale.DeliveryRecipientAddress?.City, last?.City)} label={t('Місто')} value={sale.DeliveryRecipientAddress?.City} />
      <Row changed={changed(sale.DeliveryRecipientAddress?.Department, last?.Department)} label={t('Відділення')} value={sale.DeliveryRecipientAddress?.Department} />
      {showShipmentDate && (
        <Row changed={changed(formatDate(sale.ShipmentDate), formatDate(last?.ShipmentDate))} label={t('Дата відгрузки')} value={formatDate(sale.ShipmentDate)} />
      )}
      {sale.IsPrinted && <Row label={t('Номер декларації')} value={sale.TTN} />}
      <Row changed={changed(sale.DeliveryRecipient?.FullName, last?.FullName)} label={t('Отримувач товару')} value={sale.DeliveryRecipient?.FullName} />
      <Row changed={changed(sale.DeliveryRecipient?.MobilePhone, last?.MobilePhone)} label={t('Мобільний телефон')} value={sale.DeliveryRecipient?.MobilePhone} />
      <Row changed={changed(sale.Comment, last?.Comment)} label={t('Коментар')} value={sale.Comment} />
      <Row changed={changed(Boolean(sale.IsCashOnDelivery), Boolean(last?.IsCashOnDelivery))} label={t('Наложений платіж')} value={sale.IsCashOnDelivery ? t('Так') : t('Ні')} />
      {sale.IsCashOnDelivery && (
        <Row changed={changed(sale.CashOnDeliveryAmount, last?.CashOnDeliveryAmount)} label={t('Сума накладеного платежу')} value={sale.CashOnDeliveryAmount} />
      )}
      <Row changed={changed(Boolean(sale.HasDocuments), Boolean(last?.HasDocument))} label={t('Є документи')} value={sale.HasDocuments ? t('Так') : t('Ні')} />
      {sale.CustomersOwnTtn?.Number && (
        <Row changed={changed(sale.CustomersOwnTtn.Number, last?.Number)} label={t('Власне ТТН')} value={sale.CustomersOwnTtn.Number} />
      )}
      {sale.CustomersOwnTtn?.TtnPDFPath && (
        <Anchor href={toSecure(sale.CustomersOwnTtn.TtnPDFPath)} target="_blank" rel="noopener noreferrer">
          {t('Завантажити ТТН')}
        </Anchor>
      )}
    </Stack>
  )
}

function CarrierHistory({ current, entries }: { current: SalesUkraineUpdateDataCarrier; entries: SalesUkraineUpdateDataCarrier[] }) {
  const { t } = useI18n()

  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('Історія змін відсутня')}
      </Text>
    )
  }

  // Snapshots first, then a live "current data" column that diffs against the last saved snapshot.
  const columns: Array<{ entry: SalesUkraineUpdateDataCarrier; header: string; isCurrent?: boolean }> = [
    ...entries.map((entry) => ({ entry, header: formatDateTime(entry.Created) })),
    { entry: current, header: t('Актуальні дані'), isCurrent: true },
  ]

  // `render` builds the displayed text; `compare` (text fields) returns the RAW value so the diff
  // can tell null/undefined apart from an empty string — mirroring the legacy loose `!=`, where a
  // null → '' transition (e.g. a recipient cleared) is flagged even though both cells look blank.
  const rows: Array<{
    compare?: (entry: SalesUkraineUpdateDataCarrier) => unknown
    label: string
    render: (entry: SalesUkraineUpdateDataCarrier) => string
  }> = [
    { compare: (entry) => entry.Transporter?.Name ?? null, label: t('Перевізник'), render: (entry) => entry.Transporter?.Name || '' },
    { compare: (entry) => entry.City ?? null, label: t('Місто'), render: (entry) => entry.City || '' },
    { compare: (entry) => entry.Department ?? null, label: t('Відділення'), render: (entry) => entry.Department || '' },
    { label: t('Дата відгрузки'), render: (entry) => formatDate(entry.ShipmentDate) },
    { compare: (entry) => entry.FullName ?? null, label: t('Отримувач товару'), render: (entry) => entry.FullName || '' },
    { compare: (entry) => entry.MobilePhone ?? null, label: t('Мобільний телефон'), render: (entry) => entry.MobilePhone || '' },
    { compare: (entry) => entry.Comment ?? null, label: t('Коментар'), render: (entry) => entry.Comment || '' },
    { label: t('Наложений платіж'), render: (entry) => (entry.IsCashOnDelivery ? t('Так') : t('Ні')) },
    { label: t('Сума накладеного платежу'), render: (entry) => formatNumber(entry.CashOnDeliveryAmount) },
    { label: t('Є документи'), render: (entry) => (entry.HasDocument ? t('Так') : t('Ні')) },
    { compare: (entry) => entry.Number ?? null, label: t('Власне ТТН'), render: (entry) => entry.Number || '' },
    { compare: (entry) => getUserName(entry) || null, label: t('Відповідальний'), render: (entry) => getUserName(entry) },
  ]

  return (
    <Stack gap="xs">
      <Text fw={600}>{t('Історія змін')}</Text>
      <ScrollArea type="auto">
        <Table withColumnBorders withRowBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              {columns.map((col, index) => (
                <Table.Th
                  key={`head-${index}`}
                  style={{ whiteSpace: 'nowrap', color: col.isCurrent ? 'var(--brand-orange)' : undefined }}
                >
                  {col.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.label}>
                <Table.Td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{row.label}</Table.Td>
                {columns.map((col, index) => {
                  const value = row.render(col.entry)
                  const compareFn = row.compare ?? row.render
                  const currentRaw = compareFn(col.entry)
                  const previousRaw = index > 0 ? compareFn(columns[index - 1].entry) : currentRaw
                  const isChanged = index > 0 && historyValueChanged(currentRaw, previousRaw)

                  return (
                    <Table.Td
                      key={`${row.label}-${index}`}
                      style={{
                        whiteSpace: 'nowrap',
                        // Highlight a changed value with a filled pink cell (like the legacy history
                        // grid) so the column where the change happened is immediately obvious.
                        backgroundColor: isChanged ? 'var(--mantine-color-red-2)' : undefined,
                        fontWeight: col.isCurrent ? 600 : undefined,
                      }}
                    >
                      {value}
                    </Table.Td>
                  )
                })}
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{t('Документ')}</Table.Td>
              {columns.map((col, index) => (
                <Table.Td key={`doc-${index}`}>
                  {col.entry.TtnPDFPath ? (
                    <Anchor href={toSecure(col.entry.TtnPDFPath)} target="_blank" rel="noopener noreferrer">
                      {t('Завантажити')}
                    </Anchor>
                  ) : (
                    ''
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

// Compact label/value pair for the client info block — left-aligned (not stretched) so the value
// sits right next to its label rather than across the full drawer width.
function HeaderRow({ label, value }: { label: string; value: unknown }) {
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap">
      <Text c="dimmed" size="sm" style={{ flexShrink: 0, width: 130 }}>
        {label}
      </Text>
      <Text fw={500} size="sm">
        {displayValue(value)}
      </Text>
    </Group>
  )
}

// Client code / name / invoice number + date — shown under the transporter in both view and edit.
function ClientInfo({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()

  return (
    <Stack gap={6}>
      <HeaderRow label={t('Код клієнта')} value={sale.ClientAgreement?.Client?.RegionCode?.Value} />
      <HeaderRow label={t('Назва клієнта')} value={sale.ClientAgreement?.Client?.FullName} />
      <HeaderRow
        label={t('Номер накладної та дата')}
        value={`${sale.SaleNumber?.Value ?? ''} ${formatDate(sale.Created)}`.trim()}
      />
    </Stack>
  )
}

function Row({ changed, label, value }: { changed?: boolean; label: string; value: unknown }) {
  return (
    <Group justify="space-between" align="flex-start" gap="lg" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right" c={changed ? 'orange.7' : undefined} fw={changed ? 600 : undefined}>
        {displayValue(value)}
      </Text>
    </Group>
  )
}

function normalizeCompare(value: unknown): string {
  if (value == null) {
    return ''
  }

  return String(value).trim()
}

// History-cell diff matching the legacy loose `!=`: null and undefined are equivalent to each
// other, but distinct from '' / 0 / false — so clearing a field (value → null/'') counts as a
// change even when both columns render blank.
function historyValueChanged(value: unknown, previous: unknown): boolean {
  const normalize = (input: unknown) => (input == null ? null : input)

  return normalize(value) !== normalize(previous)
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
    return Number.isFinite(value) ? String(value) : ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  return ''
}
