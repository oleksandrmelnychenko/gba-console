import {
  Anchor,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  FileInput,
  Group,
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
import { Check, Download, Pencil, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslateFunction } from '../../../shared/i18n/types'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { TransporterNameWithIcon } from '../../../shared/transporter-icons/TransporterIcon'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import {
  getSaleById,
  getSaleTransporterTypes,
  getSaleTransportersByType,
  updateSaleFromData,
  type SaleSubmitResult,
} from '../api/salesUkraineApi'
import { getSaleLifecycleStatusKey } from '../saleStatus'
import { getSaleFileMutationContext, SALE_FILE_MUTATION_INTENTS } from '../saleFileMutation'
import { SALES_TTN_FILE_ACCEPT } from '../salesPayloadGuards'
import type { SalesMutationOperationOptions } from '../salesMutationOperation'
import { usePersistentSaleFileMutation } from '../usePersistentSaleFileMutation'
import type { SalesUkraineSale, SalesUkraineTransporter, SalesUkraineUpdateDataCarrier } from '../types'
import {
  CARRIER_HISTORY_CHANGED_FIELD,
  hasCarrierHistoryField,
  hasCarrierHistoryMask,
  type CarrierHistoryChangedField,
} from './carrierHistoryFields'
import { applySaleTransporterIdentity } from './saleTransporterPayload'
import './sales-drawers.css'

const SALE_DETAILS_FORM_ID = 'sale-details-carrier-form'

type SaleDetailsFooterState = {
  isReconciliation: boolean
  isSaving: boolean
  saleKey: string
  saveDisabled: boolean
  visible: boolean
}

const HIDDEN_SALE_DETAILS_FOOTER: SaleDetailsFooterState = {
  isReconciliation: false,
  isSaving: false,
  saleKey: '',
  saveDisabled: false,
  visible: false,
}

export function SaleDetailsDrawer({
  canEdit = true,
  loadSale = getSaleById,
  sale,
  saveSale = updateSaleFromData,
  onClose,
  onSaved,
}: {
  canEdit?: boolean
  loadSale?: typeof getSaleById
  onClose: () => void
  onSaved: (sale: SalesUkraineSale | null) => void
  sale: SalesUkraineSale | null
  saveSale?: typeof updateSaleFromData
}) {
  const { t } = useI18n()
  const saleKey = sale ? String(sale.NetUid || sale.Id || '') : ''
  const [footerState, setFooterState] = useState<SaleDetailsFooterState>(HIDDEN_SALE_DETAILS_FOOTER)
  const activeFooterState = footerState.saleKey === saleKey ? footerState : HIDDEN_SALE_DETAILS_FOOTER

  return (
    <AppDrawer
      closeOnClickOutside={!activeFooterState.visible}
      closeOnEscape={!activeFooterState.visible}
      footer={
        canEdit && sale && activeFooterState.visible ? (
          <Group gap="sm" justify="flex-end">
            <Button
              className="sales-drawer-action-button"
              color="gray"
              disabled={activeFooterState.isSaving}
              form={SALE_DETAILS_FORM_ID}
              leftSection={<X size={16} />}
              type="reset"
              variant="default"
            >
              {t('Скасувати')}
            </Button>
            <Button
              className="sales-drawer-action-button"
              color={CREATE_ACTION_COLOR}
              disabled={activeFooterState.saveDisabled}
              form={SALE_DETAILS_FORM_ID}
              leftSection={<Check size={16} />}
              loading={activeFooterState.isSaving}
              type="submit"
            >
              {t(activeFooterState.isReconciliation ? 'Звірити збереження' : 'Зберегти')}
            </Button>
          </Group>
        ) : undefined
      }
      opened={Boolean(sale)}
      position="right"
      size="min(1080px, 100vw)"
      title={t('Перевізник накладної')}
      onClose={onClose}
    >
      {sale && (
        <SaleDetailsContent
          canEdit={canEdit}
          key={sale.NetUid || sale.Id}
          loadSale={loadSale}
          sale={sale}
          saleKey={saleKey}
          saveSale={saveSale}
          onFooterStateChange={setFooterState}
          onSaved={onSaved}
        />
      )}
    </AppDrawer>
  )
}

function SaleDetailsContent({
  canEdit,
  loadSale,
  sale,
  saleKey,
  saveSale,
  onFooterStateChange,
  onSaved,
}: {
  canEdit: boolean
  loadSale: typeof getSaleById
  onFooterStateChange: (state: SaleDetailsFooterState) => void
  onSaved: (sale: SalesUkraineSale | null) => void
  sale: SalesUkraineSale
  saleKey: string
  saveSale: typeof updateSaleFromData
}) {
  const { t } = useI18n()
  const fileMutation = usePersistentSaleFileMutation(
    getSaleFileMutationContext(sale),
    SALE_FILE_MUTATION_INTENTS.deliverySave,
  )
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

  // Live sale/shipment state used as the baseline for transporter edit history.
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
    TTN: ttn,
    TtnPDFPath: sale.CustomersOwnTtn?.TtnPDFPath,
    // Responsible for the "Актуальні дані" column comes from the sale's UpdateUser (legacy parity),
    // not the carrier snapshot — otherwise the cell is empty and shows as a spurious change.
    User: sale.UpdateUser,
  } as SalesUkraineUpdateDataCarrier

  async function enterEdit() {
    if (!canEdit) {
      return
    }

    setEditMode(true)

    if (transporters.length > 0) {
      return
    }

    try {
      const types = await getSaleTransporterTypes('edit')
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

  function createPayload(baseSale: SalesUkraineSale): SalesUkraineSale {
    const payload = applySaleTransporterIdentity(
      { ...baseSale, HasDetails: true },
      selectedTransporter,
    )

    if (baseSale.IsPrinted) {
      payload.TTN = ttn
    }

    if (!hasOwnTtn) {
      payload.CustomersOwnTtn = null
      payload.CustomersOwnTtnId = 0
    }

    payload.Comment = comment
    payload.IsCashOnDelivery = isCashOnDelivery
    payload.CashOnDeliveryAmount = isCashOnDelivery ? Number(cashOnDeliveryAmount) || 0 : 0
    payload.HasDocuments = hasDocuments
    payload.DeliveryRecipient = {
      ...(baseSale.DeliveryRecipient || {}),
      FullName: recipientName,
      MobilePhone: mobilePhone,
      ...(isChangedRecipient ? { Id: 0 } : {}),
    }
    payload.DeliveryRecipientAddress = {
      ...(baseSale.DeliveryRecipientAddress || {}),
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
      payload.CustomersOwnTtn = { ...(baseSale.CustomersOwnTtn || {}), Number: ownTtnNumber.trim() }
      payload.CustomersOwnTtnId = baseSale.CustomersOwnTtnId ?? baseSale.CustomersOwnTtn?.Id ?? 0
    }

    payload.IsEdited = true

    return payload
  }

  async function save() {
    setSaving(true)

    try {
      const result = fileMutation.reconciliationRequired
        ? await fileMutation.reconcile(
            'sale-update-file',
            uploadedFile,
            (frozenSale, file, operation) => replayFrozenDeliverySale(frozenSale, file, operation, saveSale),
          )
        : await fileMutation.run(
            'sale-update-file',
            createPayload(await requireHydratedDeliverySale(sale, loadSale)),
            uploadedFile,
            saveSale,
          )

      if (!result) {
        return
      }

      // The edit endpoint can return only an acknowledgement or a stale sale
      // projection. Re-read delivery details so the drawer is not switched out
      // of edit mode until the server representation actually contains the TTN.
      const refreshedSale = sale.NetUid
        ? await loadSale(sale.NetUid) ?? result.sale
        : result.sale

      const requestedOwnTtn = hasOwnTtn
      const persistedOwnTtn = Boolean(refreshedSale?.CustomersOwnTtn)
      const requestedNumber = ownTtnNumber.trim()
      const persistedNumber = refreshedSale?.CustomersOwnTtn?.Number?.trim() || ''
      const persistedFile = refreshedSale?.CustomersOwnTtn?.TtnPDFPath?.trim() || ''
      const ownTtnConfirmed = requestedOwnTtn
        ? persistedOwnTtn && (!requestedNumber || persistedNumber === requestedNumber) && (!uploadedFile || Boolean(persistedFile))
        : !persistedOwnTtn

      if (!refreshedSale || !ownTtnConfirmed) {
        notifications.show({
          color: 'red',
          message: t('Сервер не підтвердив збереження ТТН. Форму залишено відкритою'),
        })

        return
      }

      notifications.show({ color: 'green', message: t('Дані доставки збережено') })
      setEditMode(false)
      setUploadedFile(null)
      onSaved(refreshedSale)
    } catch (saveError) {
      notifications.show({
        color: 'red',
        message: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти дані доставки'),
      })
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
  const saveDisabled =
    fileMutation.reconciliationRequired &&
    (!fileMutation.canReconcile || (fileMutation.requiresFileReselection && !uploadedFile))

  useEffect(() => {
    onFooterStateChange({
      isReconciliation: fileMutation.reconciliationRequired,
      isSaving,
      saleKey,
      saveDisabled,
      visible: canEdit && isEditMode,
    })
  }, [
    canEdit,
    fileMutation.reconciliationRequired,
    isEditMode,
    isSaving,
    onFooterStateChange,
    saleKey,
    saveDisabled,
  ])

  return (
    <Stack className="sale-carrier-sheet" gap={0}>
      {fileMutation.pendingError && (
        <Alert color="orange" mb="sm" title={t('Потрібна звірка операції')}>
          <Stack gap="xs">
            <Text size="sm">{fileMutation.pendingError}</Text>
            {canEdit && !isEditMode && fileMutation.canReconcile && (
              <Button size="xs" variant="light" onClick={() => setEditMode(true)}>
                {t('Звірити збереження')}
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      {/* Single panel like the legacy: data/form on the left (client info sits under the transporter,
          edit button at the bottom), the change history table on the right. */}
      <Box className="sale-carrier-layout">
        <Box className="sale-carrier-main">
          {isEditMode ? (
        <Stack
          className="sale-carrier-edit-form"
          component="form"
          gap="sm"
          id={SALE_DETAILS_FORM_ID}
          onReset={(event) => {
            event.preventDefault()
            cancelEdit()
          }}
          onSubmit={(event) => {
            event.preventDefault()

            if (!isSaving && !saveDisabled) {
              void save()
            }
          }}
        >
          <Select
            clearable
            disabled={fileMutation.reconciliationRequired}
            searchable
            data={transporterData}
            label={t('Перевізник')}
            placeholder={t('Оберіть перевізника')}
            renderOption={({ option }) => {
              const transporter = transporters.find((item) => getTransporterValue(item) === option.value)
              return (
                <TransporterNameWithIcon
                  cssClass={transporter?.CssClass}
                  imageUrl={transporter?.ImageUrl}
                  name={option.label}
                  size={18}
                />
              )
            }}
            value={transporterId || null}
            onChange={(value) => setTransporterId(value || '')}
          />
          <ClientInfo sale={sale} />
          {showShipmentDate && (
            <TextInput
              disabled={fileMutation.reconciliationRequired}
              label={t('Дата відгрузки')}
              type="date"
              value={shipmentDate}
              onChange={(event) => setShipmentDate(event.currentTarget.value)}
            />
          )}
          {sale.IsPrinted && (
            <TextInput disabled={fileMutation.reconciliationRequired} label={t('Номер декларації')} value={ttn} onChange={(event) => setTtn(event.currentTarget.value)} />
          )}
          {isChangedAddress && (
            <Text c="orange" size="xs">
              {t('При редагуванні буде створено нову адресу одержувача')}
            </Text>
          )}
          <Group grow>
            <TextInput disabled={fileMutation.reconciliationRequired} label={t('Місто')} value={city} onChange={(event) => setCity(event.currentTarget.value)} />
            <TextInput
              disabled={fileMutation.reconciliationRequired}
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
              disabled={fileMutation.reconciliationRequired}
              label={t('Отримувач товару')}
              value={recipientName}
              onChange={(event) => setRecipientName(event.currentTarget.value)}
            />
            <TextInput
              disabled={fileMutation.reconciliationRequired}
              label={t('Мобільний телефон')}
              value={mobilePhone}
              onChange={(event) => setMobilePhone(event.currentTarget.value)}
            />
          </Group>
          <Textarea
            autosize
            disabled={fileMutation.reconciliationRequired}
            label={t('Коментар')}
            minRows={2}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
          />
          <Checkbox
            checked={isCashOnDelivery}
            disabled={fileMutation.reconciliationRequired}
            label={t('Наложений платіж')}
            onChange={(event) => setCashOnDelivery(event.currentTarget.checked)}
          />
          {isCashOnDelivery && (
            <NumberInput
              allowNegative={false}
              decimalScale={2}
              disabled={fileMutation.reconciliationRequired}
              label={t('Рекомендована покупцем сума')}
              value={cashOnDeliveryAmount}
              onChange={setCashOnDeliveryAmount}
            />
          )}
          <Checkbox
            checked={hasDocuments}
            disabled={fileMutation.reconciliationRequired}
            label={t('Є документи')}
            onChange={(event) => setHasDocuments(event.currentTarget.checked)}
          />
          <Checkbox
            checked={hasOwnTtn}
            disabled={fileMutation.reconciliationRequired}
            label={t('Власне ТТН')}
            onChange={(event) => setHasOwnTtn(event.currentTarget.checked)}
          />
          {(hasOwnTtn || fileMutation.requiresFileReselection) && (
            <Group grow align="end">
              <TextInput
                disabled={fileMutation.reconciliationRequired}
                label={t('Номер ТТН')}
                value={ownTtnNumber}
                onChange={(event) => setOwnTtnNumber(event.currentTarget.value)}
              />
              <FileInput
                accept={SALES_TTN_FILE_ACCEPT}
                clearable
                disabled={fileMutation.reconciliationRequired && !fileMutation.requiresFileReselection}
                label={t('Завантажити ТТН')}
                placeholder={t('Оберіть файл')}
                value={uploadedFile}
                onChange={setUploadedFile}
              />
            </Group>
          )}
        </Stack>
          ) : (
            <DetailsView sale={sale} />
          )}

          {/* Edit button at the bottom of the left column, under "Завантажити ТТН" (legacy order). */}
          {canEdit && !sale.IsSent && !isEditMode && (
            <Button className="sales-drawer-action-button sale-carrier-edit-button" color={CREATE_ACTION_COLOR} leftSection={<Pencil size={16} />} mt="md" variant="outline" onClick={enterEdit}>
              {t(fileMutation.reconciliationRequired ? 'Звірити операцію' : 'Редагувати')}
            </Button>
          )}
          {sale.IsSent && (
            <Badge className="app-role-pill is-green sale-carrier-sent-pill" color="teal" mt="md" variant="light">
              {t('Продаж проведено')}
            </Badge>
          )}
        </Box>

        {/* RIGHT: change history table beside the data, as in the legacy panel. */}
        <Box className="sale-carrier-history">
          <CarrierHistory current={currentCarrier} entries={Array.isArray(sale.UpdateDataCarrier) ? sale.UpdateDataCarrier : []} />
        </Box>
      </Box>
    </Stack>
  )
}

async function replayFrozenDeliverySale(
  frozenSale: SalesUkraineSale,
  file: File | null,
  operation: SalesMutationOperationOptions,
  request: typeof updateSaleFromData,
): Promise<SaleSubmitResult> {
  if (frozenSale.HasDetails !== true || !frozenSale.Order) {
    throw new Error(
      'Збережена операція містить неповні дані продажу. Автоматичний повтор заблоковано; звірте результат вручну',
    )
  }

  return request(frozenSale, file, operation)
}

async function requireHydratedDeliverySale(
  sale: SalesUkraineSale,
  loadSale: typeof getSaleById,
): Promise<SalesUkraineSale> {
  const netUid = sale.NetUid?.trim()

  if (!netUid) {
    throw new Error('Продаж не має збереженого ідентифікатора')
  }

  const hydratedSale = await loadSale(netUid)

  if (!hydratedSale || hydratedSale.HasDetails === false || !hydratedSale.Order) {
    throw new Error('Не вдалося завантажити повні дані продажу. Збереження заблоковано')
  }

  return { ...hydratedSale, HasDetails: true }
}

function DetailsView({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()

  const entries = Array.isArray(sale.UpdateDataCarrier) ? sale.UpdateDataCarrier : []
  const last = getLatestHistoryEntry(entries)
  const changed = (field: CarrierHistoryChangedField, current: unknown, previous: unknown) =>
    last != null && (hasCarrierHistoryMask(last) ? hasCarrierHistoryField(last, field) : normalizeCompare(current) !== normalizeCompare(previous))

  return (
    <Stack className="sale-carrier-details" gap="sm">
      <section className="sale-carrier-section">
        <Text className="app-section-title sale-carrier-section-title">{t('Перевезення')}</Text>
        <div className="sale-carrier-rows">
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.transporter, sale.Transporter?.Name, last?.Transporter?.Name)} label={t('Перевізник')} value={sale.Transporter?.Name || sale.Transporter?.Title}>
            <TransporterNameWithIcon
              cssClass={sale.Transporter?.CssClass}
              imageUrl={sale.Transporter?.ImageUrl}
              name={sale.Transporter?.Name || sale.Transporter?.Title}
              size={18}
            />
          </Row>
          <ClientInfo sale={sale} />
        </div>
      </section>

      <section className="sale-carrier-section">
        <Text className="app-section-title sale-carrier-section-title">{t('Адреса і отримувач')}</Text>
        <div className="sale-carrier-rows">
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.city, sale.DeliveryRecipientAddress?.City, last?.City)} label={t('Місто')} value={sale.DeliveryRecipientAddress?.City} />
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.department, sale.DeliveryRecipientAddress?.Department, last?.Department)} label={t('Відділення')} value={sale.DeliveryRecipientAddress?.Department} />
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.shipmentDate, formatDate(sale.ShipmentDate), formatDate(last?.ShipmentDate))} label={t('Дата відгрузки')} mono value={formatDate(sale.ShipmentDate)} />
          {sale.IsPrinted && <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.ttn, sale.TTN, last?.TTN)} label={t('Номер декларації')} mono value={sale.TTN} />}
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.fullName, sale.DeliveryRecipient?.FullName, last?.FullName)} label={t('Отримувач товару')} value={sale.DeliveryRecipient?.FullName} />
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.mobilePhone, sale.DeliveryRecipient?.MobilePhone, last?.MobilePhone)} label={t('Мобільний телефон')} mono value={sale.DeliveryRecipient?.MobilePhone} />
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.comment, sale.Comment, last?.Comment)} label={t('Коментар')} value={sale.Comment} />
        </div>
      </section>

      <section className="sale-carrier-section">
        <Text className="app-section-title sale-carrier-section-title">{t('Оплата і документи')}</Text>
        <div className="sale-carrier-rows">
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.isCashOnDelivery, Boolean(sale.IsCashOnDelivery), Boolean(last?.IsCashOnDelivery))} label={t('Наложений платіж')}>
            <BooleanPill active={Boolean(sale.IsCashOnDelivery)} />
          </Row>
      {sale.IsCashOnDelivery && (
            <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.cashOnDeliveryAmount, sale.CashOnDeliveryAmount, last?.CashOnDeliveryAmount)} label={t('Сума накладеного платежу')} mono value={sale.CashOnDeliveryAmount} />
      )}
          <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.hasDocument, Boolean(sale.HasDocuments), Boolean(last?.HasDocument))} label={t('Є документи')}>
            <BooleanPill active={Boolean(sale.HasDocuments)} />
          </Row>
      {sale.CustomersOwnTtn?.Number && (
            <Row changed={changed(CARRIER_HISTORY_CHANGED_FIELD.ownTtnNumber, sale.CustomersOwnTtn.Number, last?.Number)} label={t('Власне ТТН')} mono value={sale.CustomersOwnTtn.Number} />
      )}
      {sale.CustomersOwnTtn?.TtnPDFPath && (
            <Anchor className="sale-carrier-document-link" href={toSecure(sale.CustomersOwnTtn.TtnPDFPath)} target="_blank" rel="noopener noreferrer">
          <Download size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
          {t('Завантажити ТТН')}
        </Anchor>
      )}
        </div>
      </section>
    </Stack>
  )
}

export function CarrierHistory({ current, entries }: { current: SalesUkraineUpdateDataCarrier; entries: SalesUkraineUpdateDataCarrier[] }) {
  const { t } = useI18n()

  if (entries.length === 0) {
    return (
      <section className="sale-carrier-section">
      <Text className="app-section-title sale-carrier-section-title">{t('Історія змін перевізника')}</Text>
      <Text className="sale-carrier-empty-history" size="sm">
        {t('Історія змін перевізника відсутня')}
      </Text>
      </section>
    )
  }

  const sortedEntries = sortCarrierHistoryEntries(entries)
  const baseline = buildCarrierHistoryBaseline(sortedEntries[0])
  // Oldest change first ... newest change ... ActualData (current) last.
  // History cells show the fields changed by that history step. The current column repeats only the
  // latest step's changed fields, so it does not light up unrelated current values.
  const columns: Array<{ entry: SalesUkraineUpdateDataCarrier; header: string; isCurrent?: boolean; key: string }> = [
    ...(baseline ? [{ entry: baseline, header: t('Початкові дані'), key: 'baseline' }] : []),
    ...sortedEntries.map((entry, index) => ({
      entry,
      header: formatHistoryHeader(entry, index, t),
      key: getHistoryColumnKey(entry),
    })),
    { entry: current, header: t('Актуальні дані'), isCurrent: true, key: 'current' },
  ]

  // `render` builds the displayed text; `compare` (text fields) returns the RAW value so the diff
  // can tell null/undefined apart from an empty string — mirroring the legacy loose `!=`, where a
  // null → '' transition (e.g. a recipient cleared) is flagged even though both cells look blank.
  const rows: Array<{
    compare?: (entry: SalesUkraineUpdateDataCarrier) => unknown
    field?: CarrierHistoryChangedField
    key: string
    label: string
    node?: (entry: SalesUkraineUpdateDataCarrier) => ReactNode
    render: (entry: SalesUkraineUpdateDataCarrier) => string
  }> = [
    {
      compare: (entry) => entry.Transporter?.Name ?? null,
      field: CARRIER_HISTORY_CHANGED_FIELD.transporter,
      key: 'transporter',
      label: t('Перевізник'),
      node: (entry) => (
        <TransporterNameWithIcon
          cssClass={entry.Transporter?.CssClass}
          imageUrl={entry.Transporter?.ImageUrl}
          name={entry.Transporter?.Name}
          size={18}
        />
      ),
      render: (entry) => entry.Transporter?.Name || '',
    },
    { compare: (entry) => entry.City ?? null, field: CARRIER_HISTORY_CHANGED_FIELD.city, key: 'city', label: t('Місто'), render: (entry) => entry.City || '' },
    { compare: (entry) => entry.Department ?? null, field: CARRIER_HISTORY_CHANGED_FIELD.department, key: 'department', label: t('Відділення'), render: (entry) => entry.Department || '' },
    { field: CARRIER_HISTORY_CHANGED_FIELD.shipmentDate, key: 'shipmentDate', label: t('Дата відгрузки'), render: (entry) => formatDate(entry.ShipmentDate) },
    { compare: (entry) => entry.TTN ?? null, field: CARRIER_HISTORY_CHANGED_FIELD.ttn, key: 'ttn', label: t('Номер декларації'), render: (entry) => entry.TTN || '' },
    { compare: (entry) => entry.FullName ?? null, field: CARRIER_HISTORY_CHANGED_FIELD.fullName, key: 'fullName', label: t('Отримувач товару'), render: (entry) => entry.FullName || '' },
    { compare: (entry) => entry.MobilePhone ?? null, field: CARRIER_HISTORY_CHANGED_FIELD.mobilePhone, key: 'mobilePhone', label: t('Мобільний телефон'), render: (entry) => entry.MobilePhone || '' },
    { compare: (entry) => entry.Comment ?? null, field: CARRIER_HISTORY_CHANGED_FIELD.comment, key: 'comment', label: t('Коментар'), render: (entry) => entry.Comment || '' },
    { field: CARRIER_HISTORY_CHANGED_FIELD.isCashOnDelivery, key: 'isCashOnDelivery', label: t('Наложений платіж'), render: (entry) => (entry.IsCashOnDelivery ? t('Так') : t('Ні')) },
    { field: CARRIER_HISTORY_CHANGED_FIELD.cashOnDeliveryAmount, key: 'cashOnDeliveryAmount', label: t('Сума накладеного платежу'), render: (entry) => formatNumber(entry.CashOnDeliveryAmount) },
    { field: CARRIER_HISTORY_CHANGED_FIELD.hasDocument, key: 'hasDocument', label: t('Є документи'), render: (entry) => (entry.HasDocument ? t('Так') : t('Ні')) },
    { compare: (entry) => entry.Number ?? null, field: CARRIER_HISTORY_CHANGED_FIELD.ownTtnNumber, key: 'ownTtnNumber', label: t('Власне ТТН'), render: (entry) => entry.Number || '' },
    { compare: (entry) => getUserName(entry) || null, key: 'responsible', label: t('Відповідальний'), render: (entry) => getUserName(entry) },
  ]

  return (
    <section className="sale-carrier-section sale-carrier-history-section">
      <Text className="app-section-title sale-carrier-section-title">{t('Історія змін перевізника')}</Text>
      <ScrollArea offsetScrollbars="x" type="auto">
        <Table className="sales-drawer-table sale-carrier-history-table" withColumnBorders withRowBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              {columns.map((col) => (
                <Table.Th key={col.key} className={col.isCurrent ? 'is-current-col' : undefined}>
                  {col.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.key}>
                <Table.Td>{row.label}</Table.Td>
                {columns.map((col, index) => {
                  const value = row.render(col.entry)
                  const compareFn = row.compare ?? row.render
                  const currentRaw = compareFn(col.entry)
                  const previousRaw = index > 0 ? compareFn(columns[index - 1].entry) : currentRaw
                  // Historical columns show their own persisted mask. The current column mirrors only
                  // the latest save's mask, so unrelated values are never highlighted by comparison.
                  const changeSource = col.isCurrent ? sortedEntries.at(-1) : col.entry
                  const hasPersistedMask = hasCarrierHistoryMask(changeSource)
                  const isChanged = hasPersistedMask
                    ? row.field != null && hasCarrierHistoryField(changeSource, row.field)
                    : !col.isCurrent && index > 0 && historyValueChanged(currentRaw, previousRaw)
                  const cellClass = [
                    col.isCurrent ? 'is-current-col' : '',
                    isChanged ? 'is-changed' : '',
                    row.key === 'cashOnDeliveryAmount' ? 'app-table-number' : '',
                  ].filter(Boolean).join(' ')

                  return (
                    <Table.Td
                      key={`${row.key}-${col.key}`}
                      className={cellClass || undefined}
                      data-history-column={col.key}
                      data-history-field={row.key}
                    >
                      {row.node ? row.node(col.entry) : value}
                    </Table.Td>
                  )
                })}
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td>{t('Документ')}</Table.Td>
              {columns.map((col) => {
                const latest = col.isCurrent ? sortedEntries.at(-1) : col.entry
                const isChanged = hasCarrierHistoryMask(latest) && hasCarrierHistoryField(latest, CARRIER_HISTORY_CHANGED_FIELD.ttnDocument)

                return <Table.Td key={`doc-${col.key}`} className={isChanged ? 'is-changed' : undefined} data-history-column={col.key} data-history-field="ttnDocument">
                  {col.entry.TtnPDFPath ? (
                    <Anchor href={toSecure(col.entry.TtnPDFPath)} target="_blank" rel="noopener noreferrer">
                      <Download size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
                      {t('Завантажити')}
                    </Anchor>
                  ) : (
                    ''
                  )}
                </Table.Td>
              })}
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </section>
  )
}

// Compact label/value pair for the client info block — left-aligned (not stretched) so the value
// sits right next to its label rather than across the full drawer width.
function HeaderRow({ label, value }: { label: string; value: unknown }) {
  return <Row label={label} mono value={value} />
}

// Client code / name / invoice number + date — shown under the transporter in both view and edit.
function ClientInfo({ sale }: { sale: SalesUkraineSale }) {
  const { t } = useI18n()

  return (
    <>
      <HeaderRow label={t('Код клієнта')} value={sale.ClientAgreement?.Client?.RegionCode?.Value} />
      <Row label={t('Назва клієнта')} value={sale.ClientAgreement?.Client?.FullName} />
      <HeaderRow label={t('Номер накладної та дата')} value={`${sale.SaleNumber?.Value ?? ''} ${formatDate(sale.Created)}`.trim()} />
    </>
  )
}

function Row({
  changed,
  children,
  label,
  mono = false,
  value,
}: {
  changed?: boolean
  children?: ReactNode
  label: string
  mono?: boolean
  value?: unknown
}) {
  return (
    <div className={`sale-carrier-row${changed ? ' is-changed' : ''}`}>
      <span className="sale-carrier-row__label">{label}</span>
      <strong className={`sale-carrier-row__value${mono ? ' is-mono' : ''}`} title={displayValue(value)}>
        {children ?? displayValue(value)}
      </strong>
    </div>
  )
}

function BooleanPill({ active }: { active: boolean }) {
  const { t } = useI18n()

  return (
    <Badge className={`app-role-pill ${active ? 'is-green' : 'is-gray'}`} size="xs" variant="light">
      {active ? t('Так') : t('Ні')}
    </Badge>
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

function sortCarrierHistoryEntries(entries: SalesUkraineUpdateDataCarrier[]): SalesUkraineUpdateDataCarrier[] {
  return entries.toSorted(compareCarrierHistoryEntries)
}

function getLatestHistoryEntry(entries: SalesUkraineUpdateDataCarrier[]): SalesUkraineUpdateDataCarrier | null {
  return sortCarrierHistoryEntries(entries).at(-1) ?? null
}

function compareCarrierHistoryEntries(left: SalesUkraineUpdateDataCarrier, right: SalesUkraineUpdateDataCarrier): number {
  const dateCompare = getHistoryTime(left.Created) - getHistoryTime(right.Created)

  if (dateCompare !== 0) {
    return dateCompare
  }

  return getHistoryId(left) - getHistoryId(right)
}

function getHistoryTime(value?: Date | string): number {
  if (!value) {
    return 0
  }

  const time = new Date(value).getTime()

  return Number.isNaN(time) ? 0 : time
}

function getHistoryId(entry: SalesUkraineUpdateDataCarrier): number {
  const id = Number(entry.Id)

  return Number.isFinite(id) ? id : 0
}

function formatHistoryHeader(entry: SalesUkraineUpdateDataCarrier, index: number, t: TranslateFunction): string {
  // Show the change timestamp in the column header (legacy parity). The record's
  // date can arrive as Created or Updated depending on the snapshot; only when
  // neither is set do we fall back to a plain «Зміна N» label.
  const changedAt = formatDateTime(entry.Created) || formatDateTime(entry.Updated)

  return changedAt || `${t('Зміна')} ${index + 1}`
}

function getHistoryColumnKey(entry: SalesUkraineUpdateDataCarrier): string {
  if (entry.NetUid) {
    return `history-${entry.NetUid}`
  }

  const id = getHistoryId(entry)

  if (id > 0) {
    return `history-${id}`
  }

  return `history-${getHistoryTime(entry.Created)}`
}

function buildCarrierHistoryBaseline(
  firstEntry: SalesUkraineUpdateDataCarrier | undefined,
): SalesUkraineUpdateDataCarrier | null {
  const snapshot = firstEntry?.BaselineSnapshot

  if (!snapshot) {
    return null
  }

  const transporter = snapshot.TransporterId != null
    ? {
        CssClass: snapshot.TransporterCssClass ?? undefined,
        Id: snapshot.TransporterId,
        ImageUrl: snapshot.TransporterImageUrl ?? undefined,
        Name: snapshot.TransporterName ?? undefined,
        NetUid: snapshot.TransporterNetUid ?? undefined,
        TransporterTypeId: snapshot.TransporterTypeId ?? undefined,
      }
    : undefined

  return {
    CashOnDeliveryAmount: snapshot.CashOnDeliveryAmount,
    City: snapshot.City ?? undefined,
    Comment: snapshot.Comment ?? undefined,
    Department: snapshot.Department ?? undefined,
    FullName: snapshot.FullName ?? undefined,
    HasDocument: snapshot.HasDocument,
    IsCashOnDelivery: snapshot.IsCashOnDelivery,
    MobilePhone: snapshot.MobilePhone ?? undefined,
    Number: snapshot.OwnTtnNumber ?? undefined,
    ShipmentDate: snapshot.ShipmentDate ?? undefined,
    Transporter: transporter,
    TTN: snapshot.Ttn ?? undefined,
    TtnPDFPath: snapshot.TtnDocumentPath ?? undefined,
  }
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
