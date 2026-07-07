import { ActionIcon, Box, Button, Checkbox, FileInput, Group, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCircleX, IconCopy, IconUpload } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  convertVatSaleAndGetPaymentDocument,
  createSale,
  getRetailPaymentStatusBySaleId,
  getSaleTransporterTypes,
  getSaleTransportersByType,
  updateMergedSale,
  updateSaleFromData,
} from '../../api/salesUkraineApi'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import type { SaleDocumentResult, SalesUkraineRetailPaymentStatus, SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import type { WizardSplitOrderItem } from './EditShoppingCartOverlay'
import {
  getClientDeliveryRecipients,
  newDeliveryRecipient,
  newDeliveryRecipientAddress,
  type WizardDeliveryRecipient,
  type WizardDeliveryRecipientAddress,
} from './newSaleWizardApi'
import {
  clearWizardMergedSale,
  clearWizardSplitOrderItems,
  isSelfCheckout,
  useWizardMergedSale,
  useWizardSplitOrderItems,
  type NewSaleReviewValue,
} from './newSaleWizardState'
import { useWizardKeyboard, useWizardKeyHandler } from './wizardKeyboard'
import { WizardReviewCombobox, type WizardReviewComboboxOption } from './WizardReviewCombobox'
import { WizardReviewConfirmModal } from './WizardReviewConfirmModal'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const SALE_LIFE_CYCLE_STATUS_NAMES: Record<number, string> = {
  0: 'Рахунок',
  1: 'Накладна',
  2: 'Накладна',
  3: 'Відправлено',
  4: 'Отримано',
  5: 'Очікування',
}
const reviewFieldClassNames = {
  input: 'new-sale-review-field__input',
  label: 'new-sale-review-field__label',
  root: 'new-sale-review-field',
}
const reviewCheckboxClassNames = {
  body: 'new-sale-review-checkbox__body',
  input: 'new-sale-review-checkbox__input',
  label: 'new-sale-review-checkbox__label',
  root: 'new-sale-review-checkbox',
}

export function NewSaleReviewStep({
  clientNetId,
  sale,
  value,
  onBusyChange,
  onChange,
  onClose,
  onCreated,
  onMergedSubmitted,
  onRegisterSubmit,
  onVatDocuments,
  withVatAccounting,
}: {
  clientNetId: string | null
  onBusyChange?: (busy: boolean) => void
  onChange: (patch: Partial<NewSaleReviewValue>) => void
  onClose?: () => void
  onCreated?: () => void
  onMergedSubmitted?: () => void
  onRegisterSubmit?: (submit: (() => Promise<void>) | null) => void
  onVatDocuments?: (result: SaleDocumentResult) => void
  sale: SalesUkraineSale | null
  value: NewSaleReviewValue
  withVatAccounting?: boolean
}) {
  const { t } = useI18n()
  const [transporters, setTransporters] = useState<SalesUkraineTransporter[]>([])
  const [recipients, setRecipients] = useState<WizardDeliveryRecipient[]>([])
  const [retailStatus, setRetailStatus] = useState<SalesUkraineRetailPaymentStatus | null>(null)
  const [confirmOpened, setConfirmOpened] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(false)
  const enterLatchRef = useRef(false)
  const transporterSeededRef = useRef(false)
  const recipientSeededRef = useRef(false)
  const flagsSeededRef = useRef(false)
  const splitItems = useWizardSplitOrderItems()
  const mergedSale = useWizardMergedSale()
  const isMergedMode = Boolean(mergedSale)
  const retailSale = mergedSale?.unionSale ?? sale

  const latestRef = useRef({ onChange, sale, value })

  useEffect(() => {
    latestRef.current = { onChange, sale, value }
  })

  const submitSaleRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    submitSaleRef.current = submitSale
  })

  useEffect(() => {
    if (!onRegisterSubmit) {
      return
    }

    onRegisterSubmit(() => submitSaleRef.current())

    return () => {
      onRegisterSubmit(null)
    }
  }, [onRegisterSubmit])

  useEffect(() => {
    onBusyChange?.(submitting || saving)

    return () => {
      onBusyChange?.(false)
    }
  }, [onBusyChange, saving, submitting])

  useWizardKeyboard(2)

  useWizardKeyHandler((event) => {
    if (event.hotkey === 'Escape') {
      if (!confirmOpened) {
        setConfirmOpened(true)
      }

      return true
    }

    if (event.hotkey === 'Enter') {
      if (!enterLatchRef.current) {
        enterLatchRef.current = true
        void submitSale()
      }

      return true
    }

    return false
  })

  useEffect(() => {
    submitRef.current?.focus()
  }, [])

  useEffect(() => {
    const { onChange: change, value: current } = latestRef.current

    if (flagsSeededRef.current || !sale) {
      return
    }

    flagsSeededRef.current = true

    const patch: Partial<NewSaleReviewValue> = {}

    if (!current.hasOwnTtn && (sale.CustomersOwnTtnId ?? 0) > 0) {
      patch.hasOwnTtn = true
    }

    if (!current.ttnNumber && sale.CustomersOwnTtn?.Number) {
      patch.ttnNumber = sale.CustomersOwnTtn.Number
    }

    if (!current.isCashOnDelivery && sale.IsCashOnDelivery) {
      patch.isCashOnDelivery = true
    }

    if (current.codAmount === '' && typeof sale.CashOnDeliveryAmount === 'number' && sale.CashOnDeliveryAmount !== 0) {
      patch.codAmount = sale.CashOnDeliveryAmount
    }

    if (Object.keys(patch).length > 0) {
      change(patch)
    }
  }, [sale])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const types = await getSaleTransporterTypes()
        const firstType = types[0]

        if (!firstType?.NetUid) {
          if (!cancelled) {
            setTransporters([])
          }

          return
        }

        const next = await getSaleTransportersByType(firstType.NetUid)

        if (!cancelled) {
          setTransporters(next)
        }
      } catch {
        if (!cancelled) {
          setTransporters([])
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const { onChange: change, sale: currentSale, value: current } = latestRef.current

    if (transporterSeededRef.current || transporters.length === 0) {
      return
    }

    transporterSeededRef.current = true

    if (!current.transporter && currentSale?.Transporter?.NetUid) {
      const match = transporters.find((item) => item.NetUid === currentSale.Transporter?.NetUid)

      if (match) {
        change({ transporter: match })
      }
    }
  }, [transporters])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      try {
        const next = await getClientDeliveryRecipients(id)

        if (!cancelled) {
          setRecipients(next)
        }
      } catch {
        if (!cancelled) {
          setRecipients([])
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId])

  useEffect(() => {
    const { onChange: change, sale: currentSale, value: current } = latestRef.current

    if (recipientSeededRef.current || recipients.length === 0) {
      return
    }

    recipientSeededRef.current = true

    if (current.recipient) {
      return
    }

    const patch: Partial<NewSaleReviewValue> = {}
    const saleRecipient = currentSale?.DeliveryRecipient

    if (saleRecipient) {
      patch.comment = currentSale?.Comment || current.comment

      const match = recipients.find((item) => item.NetUid === saleRecipient.NetUid)

      if (match) {
        applyRecipientSelection(patch, match, currentSale?.DeliveryRecipientAddress?.NetUid)
      }
    } else if (recipients[0]) {
      applyRecipientSelection(patch, recipients[0], undefined)
    }

    if (Object.keys(patch).length > 0) {
      change(patch)
    }
  }, [recipients])

  useEffect(() => {
    const saleId = retailSale?.RetailClient ? retailSale.Id : undefined

    if (!saleId) {
      return
    }

    let cancelled = false

    async function load(id: number) {
      try {
        const next = await getRetailPaymentStatusBySaleId(id)

        if (!cancelled) {
          setRetailStatus(next)
        }
      } catch {
        if (!cancelled) {
          setRetailStatus(null)
        }
      }
    }

    void load(saleId)

    return () => {
      cancelled = true
    }
  }, [retailSale?.Id, retailSale?.RetailClient])

  const selfCheckout = isSelfCheckout(value.transporter)

  const transporterOptions: WizardReviewComboboxOption<SalesUkraineTransporter>[] = transporters.map((item, index) => ({
    entity: item,
    key: item.Id != null ? String(item.Id) : `transporter-${index}`,
    label: item.Name ? item.Name : '---',
  }))
  const transporterKey = value.transporter?.Id != null ? String(value.transporter.Id) : null

  const syntheticClientId = sale?.ClientAgreement?.Client?.Id
  // Once a real recipient is picked/created (e.g. typed-in new one), show the real list so it is
  // present among the options — otherwise the self-checkout synthetic placeholder hides it and the
  // field looks cleared after creating a recipient.
  const hasSelectedRecipient = (value.recipient?.Id ?? 0) > 0
  const recipientSource =
    selfCheckout && !hasSelectedRecipient && !recipients.some((item) => item.FullName === t('Не вибраний перевізник'))
      ? [{ FullName: '', ...(syntheticClientId ? { ClientId: syntheticClientId } : {}) } as WizardDeliveryRecipient]
      : recipients
  const recipientOptions: WizardReviewComboboxOption<WizardDeliveryRecipient>[] = recipientSource.map((item, index) => ({
    entity: item,
    key: item.Id != null ? String(item.Id) : `recipient-${index}`,
    label: item.FullName ? item.FullName : '---',
  }))
  const recipientKey = value.recipient ? (value.recipient.Id != null ? String(value.recipient.Id) : 'recipient-0') : null

  const recipientAddresses = value.recipient?.DeliveryRecipientAddresses ?? []
  const addressOptions: WizardReviewComboboxOption<WizardDeliveryRecipientAddress>[] = recipientAddresses.map(
    (item, index) => ({
      entity: item,
      key: item.Id != null ? String(item.Id) : `address-${index}`,
      label: item.Value ?? '',
    }),
  )
  const addressKey = value.address?.Id != null ? String(value.address.Id) : null

  const lifecycleKey = getSaleLifecycleTypeKey(sale?.BaseLifeCycleStatus?.SaleLifeCycleType)
  const documentTitle = sale
    ? `${withVatAccounting ? `(${t('ПДВ')}) ` : ''}${getSaleLifeCycleStatusName(sale)} ${sale.SaleNumber?.Value ?? ''}`.trim()
    : ''
  const primaryLabel = isMergedMode
    ? t('Створити накладну')
    : sale
      ? sale.IsVatSale
        ? t('Завантажити рахунок на оплату')
        : lifecycleKey === '0'
          ? t('Створити накладну')
          : t('Оновити накладну')
      : t('Створити продаж')

  function selectTransporter(transporter: SalesUkraineTransporter) {
    onChange({ transporter })
  }

  function selectRecipient(recipient: WizardDeliveryRecipient) {
    const addresses = recipient.DeliveryRecipientAddresses ?? []

    onChange({
      address: addresses[0] ?? null,
      addressValue: '',
      isNewRecipient: false,
      recipient,
      recipientName: recipient.FullName || '',
    })
  }

  function selectAddress(address: WizardDeliveryRecipientAddress) {
    onChange({ address, addressValue: '' })
  }

  function clearAddress() {
    const empty = recipientAddresses.find((item) => item.Value === '')

    onChange({ address: empty ?? null, addressValue: '' })
  }

  async function createRecipient(fullName: string) {
    const clientId = syntheticClientId

    if (!clientId) {
      notifications.show({ color: 'red', message: t('Не вдалося визначити клієнта для отримувача') })

      return
    }

    try {
      const created = await newDeliveryRecipient({ ClientId: clientId, FullName: fullName })

      if (created && (created.Id ?? 0) > 0) {
        setRecipients((current) => [...current, created])
        onChange({ isNewRecipient: false, recipient: created, recipientName: created.FullName || '' })
      } else {
        notifications.show({ color: 'red', message: t('Не вдалося створити отримувача') })
      }
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити отримувача') })
    }
  }

  async function createAddress(input: string) {
    const recipient = value.recipient
    const recipientId = recipient?.Id

    if (!recipient || !recipientId || recipientId <= 0) {
      return
    }

    const addresses = recipient.DeliveryRecipientAddresses ?? []
    const duplicate = addresses.some((item) => (item.Value ?? '').toLowerCase() === input.toLowerCase())

    if (duplicate || input.length <= 3) {
      return
    }

    try {
      const created = await newDeliveryRecipientAddress({
        DeliveryRecipient: recipient,
        DeliveryRecipientId: recipientId,
        Value: input,
      })

      if (created && (created.Id ?? 0) > 0) {
        const updated = { ...recipient, DeliveryRecipientAddresses: [...addresses, created] }

        setRecipients((current) => current.map((item) => (item.Id === recipientId ? updated : item)))
        onChange({ address: created, addressValue: '', recipient: updated })
      } else {
        notifications.show({ color: 'red', message: t('Не вдалося створити адресу доставки') })
      }
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося створити адресу доставки') })
    }
  }

  function getCarrierValidationError(): string | null {
    if (!((value.transporter?.Id ?? 0) > 0)) {
      return 'Не вибраний перевізник'
    }

    if (!isSelfCheckout(value.transporter) && !((value.recipient?.Id ?? 0) > 0)) {
      return 'Не вибраний одержувач'
    }

    return null
  }

  function buildPayload(mode: 'create' | 'save', current: SalesUkraineSale): SalesUkraineSale & { IsEdited?: boolean } {
    const selfCheckoutPayload = isSelfCheckout(value.transporter)
    const recipientId = selfCheckoutPayload ? null : getPositiveId(value.recipient?.Id)
    const addressId = selfCheckoutPayload ? null : getPositiveId(value.address?.Id)
    const payload: SalesUkraineSale & { IsEdited?: boolean } = {
      ...current,
      CashOnDeliveryAmount: selfCheckoutPayload ? 0 : Number(value.codAmount),
      Comment: value.comment,
      DeliveryRecipient: selfCheckoutPayload
        ? null
        : ({ ...(value.recipient ?? {}), ...(recipientId ? { Id: recipientId } : {}), MobilePhone: value.mobilePhone } as SalesUkraineSale['DeliveryRecipient']),
      DeliveryRecipientAddress: selfCheckoutPayload
        ? null
        : ({
            ...(value.address ?? {}),
            City: value.city,
            Department: value.department,
            ...(addressId ? { Id: addressId } : {}),
          } as SalesUkraineSale['DeliveryRecipientAddress']),
      DeliveryRecipientAddressId: addressId,
      DeliveryRecipientId: recipientId,
      IsCashOnDelivery: selfCheckoutPayload ? false : value.isCashOnDelivery,
      Transporter: value.transporter ?? current.Transporter,
    }

    payload.CustomersOwnTtn =
      current.CustomersOwnTtn || value.ttnNumber
        ? { ...(current.CustomersOwnTtn ?? {}), Number: value.ttnNumber }
        : current.CustomersOwnTtn ?? null

    if (mode === 'create') {
      payload.BaseLifeCycleStatus = { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SaleLifeCycleType: 1 }
      payload.BaseSalePaymentStatus = { Deleted: false, Id: 0, NetUid: EMPTY_GUID, SalePaymentStatusType: 0 }
      payload.IsPrintedPaymentInvoice = true
    } else {
      payload.IsEdited = true
    }

    return payload
  }

  async function submitSale() {
    if (!sale || busyRef.current) {
      return
    }

    const error = getCarrierValidationError()

    if (error) {
      notifications.show({ color: 'red', message: t(error) })

      return
    }

    if (retailSale?.RetailClient && retailStatus && String(retailStatus.Id ?? 0) !== '0' && (retailStatus.Amount ?? 0) <= 0) {
      notifications.show({
        autoClose: 990000,
        color: 'red',
        message: t('Замовлення не буде відвантажено (створено видаткову накладну) поки не буде здійснена оплата (передплата)'),
      })

      return
    }

    busyRef.current = true
    setSubmitting(true)

    try {
      const isSplitedSale = splitItems.length > 0

      if (isMergedMode) {
        try {
          if (isSplitedSale) {
            const result = await createSale(buildPayload('create', buildSplitSale(sale, splitItems)))

            notifications.show({ color: 'green', message: result.message || t('Рахунок створено') })
          } else {
            const payload = buildPayload('create', sale)
            payload.Order = { ...(sale.Order ?? {}), OrderItems: mergedSale?.orderItems ?? sale.Order?.OrderItems ?? [] }

            await updateMergedSale(payload)
            notifications.show({ color: 'green', message: t('Рахунок створено') })
          }
        } catch {
          notifications.show({ color: 'red', message: t('Не вдалося створити рахунок') })
        }

        clearWizardSplitOrderItems()
        clearWizardMergedSale()
        onCreated?.()
        onMergedSubmitted?.()

        return
      }

      const payload = buildPayload('create', isSplitedSale ? buildSplitSale(sale, splitItems) : sale)

      if (payload.IsVatSale) {
        const documentResult = await convertVatSaleAndGetPaymentDocument(payload, value.ttnFile)

        onVatDocuments?.(documentResult)
      } else if (isSplitedSale) {
        const result = await createSale(payload)

        notifications.show({ color: 'green', message: result.message || t('Продаж створено') })
      } else {
        const result = await updateSaleFromData(payload, value.ttnFile)

        notifications.show({ color: 'green', message: result.message || t('Продаж створено') })
      }

      clearWizardSplitOrderItems()
      onCreated?.()
      onClose?.()
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося завершити продаж') })
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }

  async function saveSale(): Promise<boolean> {
    if (!sale || busyRef.current || isMergedMode) {
      return false
    }

    const error = getCarrierValidationError()

    if (error) {
      notifications.show({ color: 'red', message: t(error) })

      return false
    }

    busyRef.current = true
    setSaving(true)

    try {
      const result = await updateSaleFromData(buildPayload('save', sale), value.ttnFile)

      notifications.show({ color: 'green', message: result.message || t('Збережено') })
      onCreated?.()

      return true
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося зберегти продаж') })

      return false
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  async function handleSave() {
    if (await saveSale()) {
      onClose?.()
    }
  }

  function handleConfirmClose() {
    setConfirmOpened(false)
    void saveSale()
    onClose?.()
  }

  function handleCancelClose() {
    setConfirmOpened(false)
    window.setTimeout(() => submitRef.current?.focus(), 0)
  }

  return (
    <Box className="new-sale-review-step app-form-sheet">
      <Box className="new-sale-review-step__body">
        <Box className="new-sale-review-form app-form-sheet">
          <Box className="new-sale-review-layout">
            <Box className="new-sale-review-main">
              {documentTitle && (
                <Box className="new-sale-review-document-head">
                  <span className="new-sale-review-document-head__icon" aria-hidden="true">
                    <IconCopy size={17} stroke={1.8} />
                  </span>
                  <Text className="new-sale-review-document-head__title" title={documentTitle}>
                    {documentTitle}
                  </Text>
                </Box>
              )}

              <Box className="new-sale-review-section">
                <Box className="new-sale-review-section__head">
                  <Text className="new-sale-review-section__title">{t('Доставка')}</Text>
                </Box>

                <Box className="new-sale-review-grid">
                  <WizardReviewCombobox
                    classNames={reviewFieldClassNames}
                    label={t('Перевізник')}
                    options={transporterOptions}
                    selectedKey={transporterKey}
                    tabIndex={-1}
                    onSelect={selectTransporter}
                  />

                  <WizardReviewCombobox
                    allowFreeForm
                    classNames={reviewFieldClassNames}
                    label={t('Одержувач')}
                    options={recipientOptions}
                    selectedKey={recipientKey}
                    onFreeText={(input) => void createRecipient(input)}
                    onSelect={selectRecipient}
                  />

                  {!selfCheckout && (
                    <>
                      <Box className="new-sale-review-field-span">
                        <Group className="new-sale-review-address-row" align="flex-end" gap={8} wrap="nowrap">
                          <Box className="new-sale-review-address-control">
                            <WizardReviewCombobox
                              allowFreeForm
                              classNames={reviewFieldClassNames}
                              label={t('Адреса')}
                              options={addressOptions}
                              selectedKey={addressKey}
                              onFreeText={(input) => void createAddress(input)}
                              onSelect={selectAddress}
                            />
                          </Box>
                          <ActionIcon
                            aria-label={t('Очистити адресу')}
                            className="new-sale-review-clear"
                            color="gray"
                            size="lg"
                            variant="subtle"
                            onClick={clearAddress}
                          >
                            <IconCircleX size={17} />
                          </ActionIcon>
                        </Group>
                      </Box>

                      <TextInput
                        classNames={reviewFieldClassNames}
                        label={t('Місто')}
                        value={value.city}
                        onChange={(event) => onChange({ city: event.currentTarget.value })}
                      />
                      <TextInput
                        classNames={reviewFieldClassNames}
                        label={t('Відділення')}
                        value={value.department}
                        onChange={(event) => onChange({ department: event.currentTarget.value })}
                      />
                    </>
                  )}

                  <TextInput
                    classNames={reviewFieldClassNames}
                    label={t('Мобільний телефон')}
                    value={value.mobilePhone}
                    onChange={(event) => onChange({ mobilePhone: event.currentTarget.value })}
                  />
                  <TextInput
                    classNames={reviewFieldClassNames}
                    label={t('Коментар')}
                    value={value.comment}
                    onChange={(event) => onChange({ comment: event.currentTarget.value === '' ? ' ' : event.currentTarget.value })}
                  />
                </Box>
              </Box>

              <Box className="new-sale-review-section">
                <Box className="new-sale-review-section__head">
                  <Text className="new-sale-review-section__title">{t('Оплата і документи')}</Text>
                </Box>

                <Box className="new-sale-review-options">
                  <Box className={`new-sale-review-option-row ${value.isCashOnDelivery ? 'is-active' : 'is-idle'}`}>
                    <Checkbox
                      checked={value.isCashOnDelivery}
                      classNames={reviewCheckboxClassNames}
                      label={t('Наложений платіж')}
                      onChange={() => onChange({ isCashOnDelivery: !value.isCashOnDelivery })}
                    />
                    {value.isCashOnDelivery ? (
                      <TextInput
                        classNames={reviewFieldClassNames}
                        label={t('Рекомендована покупцем')}
                        value={String(value.codAmount)}
                        onChange={(event) => onChange({ codAmount: event.currentTarget.value })}
                      />
                    ) : null}
                  </Box>

                  <Box className={`new-sale-review-option-row ${value.hasOwnTtn ? 'is-active' : 'is-idle'}`}>
                    <Checkbox
                      checked={value.hasOwnTtn}
                      classNames={reviewCheckboxClassNames}
                      label={t('Власне ТТН')}
                      onChange={() => onChange({ hasOwnTtn: !value.hasOwnTtn })}
                    />
                    {value.hasOwnTtn ? (
                      <TextInput
                        autoFocus
                        aria-label={t('Номер ТТН')}
                        classNames={reviewFieldClassNames}
                        label={t('Номер ТТН')}
                        value={value.ttnNumber}
                        onChange={(event) => onChange({ ttnNumber: event.currentTarget.value })}
                      />
                    ) : null}
                  </Box>

                  {value.hasOwnTtn && (
                    <Box className="new-sale-review-option-row is-upload">
                      <Box className="new-sale-review-option-spacer" />
                      <FileInput
                        classNames={reviewFieldClassNames}
                        label={t('Файл ТТН')}
                        leftSection={<IconUpload size={16} />}
                        placeholder={t('Завантажити')}
                        value={value.ttnFile}
                        onChange={(file) => {
                          if (file) {
                            onChange({ ttnFile: file })
                          }
                        }}
                      />
                    </Box>
                  )}

                  {(sale?.Id ?? 0) > 0 && sale?.CustomersOwnTtn?.TtnPDFPath ? (
                    <Group className="new-sale-review-field-span" justify="flex-start">
                      <Button
                        className="new-sale-review-link-button"
                        component="a"
                        href={sale.CustomersOwnTtn.TtnPDFPath}
                        rel="noopener noreferrer"
                        target="_blank"
                        variant="outline"
                      >
                        {t('Завантажити ТТН')}
                      </Button>
                    </Group>
                  ) : null}
                </Box>
              </Box>
            </Box>
          </Box>

          <Group className="new-sale-review-actions" gap="sm" justify="flex-end">
            {sale && !isMergedMode ? (
              <Button className="new-sale-review-actions__secondary" color="gray" loading={saving} variant="light" onClick={() => void handleSave()}>
                {t('Зберегти')}
              </Button>
            ) : null}
            <Button ref={submitRef} className="new-sale-review-actions__primary" loading={submitting} onClick={() => void submitSale()}>
              {primaryLabel}
            </Button>
          </Group>
        </Box>
      </Box>

      <WizardReviewConfirmModal opened={confirmOpened} onCancel={handleCancelClose} onConfirm={handleConfirmClose} />
    </Box>
  )
}

function buildSplitSale(current: SalesUkraineSale, items: WizardSplitOrderItem[]): SalesUkraineSale {
  return {
    ClientAgreement: current.ClientAgreement,
    CustomersOwnTtn: current.CustomersOwnTtn ?? null,
    Deleted: false,
    Id: 0,
    NetUid: EMPTY_GUID,
    Order: {
      Deleted: false,
      Id: 0,
      NetUid: EMPTY_GUID,
      OrderItems: items.map((item) => ({
        Comment: item.Comment ?? '',
        Deleted: false,
        Id: 0,
        NetUid: EMPTY_GUID,
        Product: item.Product,
        Qty: item.Qty,
        TotalAmount: item.TotalAmount,
        TotalAmountLocal: item.TotalAmountLocal,
        User: item.User,
      })),
    },
    TTN: current.TTN,
  }
}

function applyRecipientSelection(
  patch: Partial<NewSaleReviewValue>,
  recipient: WizardDeliveryRecipient,
  preferredAddressNetUid: string | undefined,
) {
  patch.recipient = recipient
  patch.recipientName = recipient.FullName || ''
  patch.isNewRecipient = false
  patch.mobilePhone = recipient.MobilePhone || ''

  const addresses = recipient.DeliveryRecipientAddresses ?? []
  const preferred = preferredAddressNetUid ? addresses.find((item) => item.NetUid === preferredAddressNetUid) : undefined
  const address = preferred ?? addresses[0] ?? null

  patch.address = address
  patch.addressValue = ''
  patch.city = address?.City || ''
  patch.department = address?.Department || ''
}

function getPositiveId(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function getSaleLifeCycleStatusName(sale: SalesUkraineSale): string {
  const type = Number(sale.BaseLifeCycleStatus?.SaleLifeCycleType)

  return Number.isFinite(type) ? (SALE_LIFE_CYCLE_STATUS_NAMES[type] ?? '') : ''
}
