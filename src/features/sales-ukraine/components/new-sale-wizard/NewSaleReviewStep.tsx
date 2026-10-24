import { ActionIcon, Alert, Box, Button, Checkbox, FileInput, Group, NumberInput, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleX, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getRetailPaymentStatusBySaleId, getSaleTransporterTypes, getSaleTransportersByType } from '../../api/salesUkraineApi'
import { getSaleLocalCurrencyCode, isNonVatEurSale } from '../../saleMoney'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import { SALES_TTN_FILE_ACCEPT, getSalesTtnFileValidationError } from '../../salesPayloadGuards'
import type { SaleDocumentResult, SalesUkraineRetailPaymentStatus, SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import { SaleDocumentWarehouseSelect } from './SaleDocumentWarehouseSelect'
import { WizardReviewCombobox, type WizardReviewComboboxOption } from './WizardReviewCombobox'
import { WizardReviewConfirmModal } from './WizardReviewConfirmModal'
import { WizardReviewOrderSummary, WizardReviewOrderTotals } from './WizardReviewOrderSummary'
import {
  getClientDeliveryRecipients,
  newDeliveryRecipient,
  newDeliveryRecipientAddress,
  type WizardDeliveryRecipient,
  type WizardDeliveryRecipientAddress,
} from './newSaleWizardApi'
import { isSelfCheckout, type NewSaleReviewValue } from './newSaleWizardState'
import { useWizardSaleSubmission } from './useWizardSaleSubmission'
import './wizard-review-checkout.css'
import { useWizardKeyHandler, useWizardKeyboard } from './wizardKeyboard'

const LOCAL_ORDER_SOURCE = 1
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
  canSubmit = true,
  canConvertMergedToBill = false,
  clientNetId,
  sale,
  value,
  onBusyChange,
  onChange,
  onClose,
  onCreated,
  onSaved,
  onMergedSubmitted,
  onRegisterSubmit,
  onRequestClose,
  onVatDocuments,
  submitDeniedReason = 'Недостатньо прав для завершення операції',
  submitFlow = 'edit',
  withVatAccounting,
}: {
  canSubmit?: boolean
  canConvertMergedToBill?: boolean
  clientNetId: string | null
  onBusyChange?: (busy: boolean) => void
  onChange: (patch: Partial<NewSaleReviewValue>) => void
  onClose?: () => void
  onCreated?: () => void
  onSaved?: (sale: SalesUkraineSale | null) => void | Promise<void>
  onMergedSubmitted?: () => void
  onRegisterSubmit?: (submit: (() => Promise<void>) | null) => void
  onRequestClose?: () => void
  onVatDocuments?: (result: SaleDocumentResult) => void
  sale: SalesUkraineSale | null
  value: NewSaleReviewValue
  submitDeniedReason?: string
  submitFlow?: 'create' | 'edit'
  withVatAccounting?: boolean
}) {
  const { t } = useI18n()
  const [transporters, setTransporters] = useState<SalesUkraineTransporter[]>([])
  const [recipients, setRecipients] = useState<WizardDeliveryRecipient[]>([])
  const [retailStatus, setRetailStatus] = useState<SalesUkraineRetailPaymentStatus | null>(null)
  const [confirmOpened, setConfirmOpened] = useState(false)
  const submitRef = useRef<HTMLButtonElement>(null)
  const transporterSeededRef = useRef(false)
  const recipientSeededRef = useRef(false)
  const flagsSeededRef = useRef(false)
  const needsDocumentWarehouse = sale?.Order?.OrderSource !== LOCAL_ORDER_SOURCE
  const {
    blockedFileMutation,
    effectiveSubmitDeniedReason,
    finalSubmitOutcomePending,
    isMergedMode,
    retailSale,
    reviewItems,
    saveSale,
    saving,
    splitItems,
    submitFromKeyboard,
    submitPermissionDenied,
    submitSale,
    submitting,
  } = useWizardSaleSubmission({
    canSubmit,
    canConvertMergedToBill,
    clientNetId,
    sale,
    value,
    retailStatus,
    submitDeniedReason,
    submitFlow,
    onBusyChange,
    onClose,
    onCreated,
    onSaved,
    onMergedSubmitted,
    onVatDocuments,
  })
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

  useWizardKeyboard(2)

  useWizardKeyHandler((event) => {
    if (event.hotkey === 'Escape') {
      if (finalSubmitOutcomePending) {
        const requestClose = onRequestClose ?? onClose
        requestClose?.()

        return true
      }

      if (!confirmOpened) {
        setConfirmOpened(true)
      }

      return true
    }

    if (event.hotkey === 'Enter') {
      submitFromKeyboard()

      return true
    }

    return false
  })

  useEffect(() => {
    submitRef.current?.focus({ preventScroll: true })
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
        const types = await getSaleTransporterTypes(submitFlow)
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
  }, [submitFlow])

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
  const primaryLabel = submitting && withVatAccounting
    ? t('Продаж збережено · формуємо документи…')
    : finalSubmitOutcomePending
    ? t('Перевірити результат')
    : isMergedMode
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
    const normalizedInput = input.trim()

    if (!recipient || !recipientId || recipientId <= 0 || !normalizedInput) {
      return
    }

    const addresses = recipient.DeliveryRecipientAddresses ?? []
    const duplicate = addresses.find(
      (item) => (item.Value ?? '').trim().toLowerCase() === normalizedInput.toLowerCase(),
    )

    if (duplicate) {
      selectAddress(duplicate)

      return
    }

    try {
      const created = await newDeliveryRecipientAddress({
        DeliveryRecipient: recipient,
        DeliveryRecipientId: recipientId,
        Value: normalizedInput,
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

  function selectTtnFile(file: File | null) {
    const fileError = getSalesTtnFileValidationError(file)

    if (fileError) {
      notifications.show({ color: 'red', message: t(fileError) })
      onChange({ ttnFile: null })

      return
    }

    onChange({ ttnFile: file })
  }

  async function handleSave() {
    await saveSale()
  }

  async function handleConfirmClose() {
    if (finalSubmitOutcomePending) {
      setConfirmOpened(false)
      const requestClose = onRequestClose ?? onClose
      requestClose?.()

      return
    }

    setConfirmOpened(false)

    if (await saveSale()) {
      onClose?.()
    }
  }

  function handleCancelClose() {
    setConfirmOpened(false)
    window.setTimeout(() => submitRef.current?.focus(), 0)
  }

  return (
    <Box className="new-sale-review-step new-sale-review-checkout app-form-sheet">
      {blockedFileMutation && (
        <Alert color="orange" mb="sm" title={t('Потрібна звірка операції')}>
          <Text size="sm">
            {blockedFileMutation.canResume
              ? t('Попередній запит із файлом міг завершитися на сервері. Повторно оберіть той самий файл: система звірить SHA-256 і повторить незмінний запит із тим самим ключем.')
              : t('Неможливо безпечно визначити дію попереднього запиту. Завершіть файлову операцію на початковому екрані або дочекайтеся завершення строку звірки.')}
          </Text>
          {blockedFileMutation.canResume ? (
            <Group align="flex-end" gap="sm" mt="sm">
              <FileInput
                accept={SALES_TTN_FILE_ACCEPT}
                aria-label={t('Повторно оберіть файл для звірки')}
                clearable
                leftSection={<Upload size={16} />}
                placeholder={t('Завантажити')}
                value={value.ttnFile}
                onChange={selectTtnFile}
              />
              <Button
                disabled={!value.ttnFile}
                loading={submitting}
                size="xs"
                onClick={() => void submitSale()}
              >
                {t('Перевірити результат')}
              </Button>
            </Group>
          ) : null}
        </Alert>
      )}
      <Box className="new-sale-review-step__body">
        <Box className="new-sale-review-form app-form-sheet">
          <Box className="new-sale-review-layout">
            <WizardReviewOrderSummary
              items={reviewItems}
              localCurrencyCode={getSaleLocalCurrencyCode(sale)}
              useEurToUah={isNonVatEurSale(sale)}
            />
            <Box className="new-sale-review-main">
              {needsDocumentWarehouse && (
                <Box className="new-sale-review-section">
                  <SaleDocumentWarehouseSelect
                    value={value.registrarStorageId ?? sale?.RegistrarStorageId ?? null}
                    flow={submitFlow}
                    disabled={(Boolean(sale?.ChangedToInvoice) && splitItems.length === 0 && !isMergedMode) || submitting || saving || !canSubmit}
                    onChange={(registrarStorageId) => onChange({ registrarStorageId })}
                  />
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
                              draftValue={value.addressValue}
                              label={t('Адреса')}
                              options={addressOptions}
                              selectedKey={addressKey}
                              onDraftChange={(addressValue) => onChange({ addressValue })}
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
                            <CircleX size={17} />
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
                      <NumberInput
                        allowNegative={false}
                        classNames={reviewFieldClassNames}
                        decimalScale={2}
                        label={t('Рекомендована покупцем')}
                        min={0}
                        value={value.codAmount}
                        onChange={(codAmount) => onChange({ codAmount })}
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
                        accept={SALES_TTN_FILE_ACCEPT}
                        clearable
                        classNames={reviewFieldClassNames}
                        label={t('Файл ТТН')}
                        leftSection={<Upload size={16} />}
                        placeholder={t('Завантажити')}
                        value={value.ttnFile}
                        onChange={selectTtnFile}
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

              <Group className="new-sale-review-actions" gap="sm" justify="flex-end">
                {sale && !isMergedMode ? (
                  <Button className="new-sale-review-actions__secondary" color="gray" disabled={finalSubmitOutcomePending} loading={saving} variant="light" onClick={() => void handleSave()}>
                    {t('Зберегти')}
                  </Button>
                ) : null}
                <Button
                  ref={submitRef}
                  className="new-sale-review-actions__primary"
                  disabled={submitPermissionDenied || Boolean(blockedFileMutation && !blockedFileMutation.canResume)}
                  loading={submitting}
                  title={submitPermissionDenied ? effectiveSubmitDeniedReason : undefined}
                  onClick={() => void submitSale()}
                >
                  {primaryLabel}
                </Button>
              </Group>
            </Box>
          </Box>
        </Box>
      </Box>

      <WizardReviewOrderTotals
        items={reviewItems}
        localCurrencyCode={getSaleLocalCurrencyCode(sale)}
        useEurToUah={isNonVatEurSale(sale)}
      />
      <WizardReviewConfirmModal opened={confirmOpened} onCancel={handleCancelClose} onConfirm={() => void handleConfirmClose()} />
    </Box>
  )
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
