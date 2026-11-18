import { ActionIcon, Alert, Box, Button, Checkbox, FileInput, Group, Modal, NumberInput, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleX, Upload } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleConvertedCurrencyCode, isUahConvertedSale } from '../../saleMoney'
import { getSaleLifecycleTypeKey } from '../../saleStatus'
import { SALES_TTN_FILE_ACCEPT, getSalesTtnFileValidationError } from '../../salesPayloadGuards'
import type { SaleDocumentResult, SalesUkraineSale } from '../../types'
import { SaleDocumentWarehouseSelect } from './SaleDocumentWarehouseSelect'
import { WizardReviewCombobox } from './WizardReviewCombobox'
import { WizardReviewConfirmModal } from './WizardReviewConfirmModal'
import { WizardReviewOrderSummary, WizardReviewOrderTotals } from './WizardReviewOrderSummary'
import type { NewSaleReviewValue } from './newSaleWizardState'
import { useWizardDeliveryDetails } from './useWizardDeliveryDetails'
import { SALE_COMMENT_MAX_LENGTH, SALE_OWN_TTN_MAX_LENGTH, useWizardSaleSubmission } from './useWizardSaleSubmission'
import './wizard-review-checkout.css'
import { useWizardReviewKeyboard } from './useWizardReviewKeyboard'
import { toSameOriginDataUrl } from '../../../../shared/url/sameOriginDataUrl'
import {
  COMMERCIAL_RATE_LABEL,
  DRAFT_RATE_NOTE,
  formatCommercialRate,
  getSaleCommercialRate,
  getSaleDraftCommercialRate,
} from '../../../../shared/money/exchangeRateLabels'

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
  agreementNetId,
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
  /** The sale agreement: the order lines show the same price types as on the products step. */
  agreementNetId?: string | null
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
  // Owner decision: the user sees which rate the sale was priced at (commercial, EUR -> agreement currency).
  const saleRate = getSaleCommercialRate(sale)
  // A draft «Рахунок» has no frozen rate yet: show the current one it is priced at, marked as such.
  const draftRate = saleRate ? null : getSaleDraftCommercialRate(sale)
  const needsDocumentWarehouse = sale?.Order?.OrderSource !== LOCAL_ORDER_SOURCE
  const [discardConfirmOpened, setDiscardConfirmOpened] = useState(false)
  const {
    selfCheckout,
    transporterOptions, transporterKey, selectTransporter,
    recipientOptions, recipientKey, selectRecipient, createRecipient, commitDraftRecipient,
    addressOptions, addressKey, selectAddress, clearAddress, createAddress,
  } = useWizardDeliveryDetails({ clientNetId, sale, value, onChange, submitFlow })
  const {
    blockedFileMutation,
    discardPendingFileMutation,
    effectiveSubmitDeniedReason,
    finalSubmitOutcomePending,
    isMergedMode,
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
    submitDeniedReason,
    submitFlow,
    onBusyChange,
    onClose,
    onCreated,
    onSaved,
    onMergedSubmitted,
    onVatDocuments,
    prepareDeliveryRecipient: commitDraftRecipient,
  })

  const deliveryContextKey = JSON.stringify([clientNetId, sale?.NetUid ?? sale?.Id ?? null, submitFlow])
  const { confirmOpened, submitRef, handleConfirmClose, handleCancelClose } = useWizardReviewKeyboard({
    contextKey: deliveryContextKey, finalSubmitOutcomePending, busy: saving || submitting,
    submitSale, submitFromKeyboard, saveSale, onClose, onRequestClose, onRegisterSubmit,
  })

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
                placeholder={t('Оберіть файл')}
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
      {finalSubmitOutcomePending && !blockedFileMutation && (
        <Alert color="orange" mb="sm" title={t('Результат попереднього збереження невідомий')}>
          <Text size="sm">
            {t('Сервер не підтвердив попередній запит. «Перевірити результат» повторить той самий запит. Якщо дані треба змінити, скасуйте незавершену операцію: продаж буде перезавантажено з сервера.')}
          </Text>
          <Group gap="sm" mt="sm">
            <Button color="orange" disabled={submitting || saving} size="xs" variant="light" onClick={() => setDiscardConfirmOpened(true)}>
              {t('Скасувати незавершену операцію')}
            </Button>
          </Group>
        </Alert>
      )}
      <Modal
        centered
        opened={discardConfirmOpened}
        title={t('Скасувати незавершену операцію?')}
        onClose={() => setDiscardConfirmOpened(false)}
      >
        <Text size="sm">
          {t('Запит більше не буде повторено. Перевірте дані продажу після перезавантаження: сервер міг уже зберегти частину змін.')}
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDiscardConfirmOpened(false)}>{t('Ні')}</Button>
          <Button
            color="orange"
            onClick={() => {
              setDiscardConfirmOpened(false)
              void discardPendingFileMutation()
            }}
          >
            {t('Скасувати операцію')}
          </Button>
        </Group>
      </Modal>
      <Box className="new-sale-review-step__body">
        <Box className="new-sale-review-form app-form-sheet">
          <Box className="new-sale-review-layout">
            <WizardReviewOrderSummary
              agreementNetId={agreementNetId}
              items={reviewItems}
              localCurrencyCode={getSaleConvertedCurrencyCode(sale)}
              useEurToUah={isUahConvertedSale(sale)}
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
                    contextKey={deliveryContextKey}
                    onSelect={selectTransporter}
                  />

                  <WizardReviewCombobox
                    allowFreeForm
                    classNames={reviewFieldClassNames}
                    contextKey={deliveryContextKey}
                    label={t('Одержувач')}
                    options={recipientOptions}
                    selectedKey={recipientKey}
                    onFreeText={createRecipient}
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
                              contextKey={JSON.stringify([deliveryContextKey, value.recipient?.NetUid ?? value.recipient?.Id ?? null])}
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
                    maxLength={SALE_COMMENT_MAX_LENGTH}
                    value={value.comment}
                    onChange={(event) => onChange({ comment: event.currentTarget.value === '' ? ' ' : event.currentTarget.value })}
                  />
                </Box>
              </Box>

              <Box className="new-sale-review-section">
                <Box className="new-sale-review-section__head">
                  <Text className="new-sale-review-section__title">{t('Оплата і документи')}</Text>
                </Box>
                {saleRate ? (
                  <Text className="new-sale-review-rate" size="sm" c="dimmed" data-testid="sale-commercial-rate">
                    {t(COMMERCIAL_RATE_LABEL)} {saleRate.pair}: {formatCommercialRate(saleRate.rate)}
                  </Text>
                ) : draftRate ? (
                  <Text className="new-sale-review-rate" size="sm" c="dimmed" data-testid="sale-commercial-rate">
                    {t(COMMERCIAL_RATE_LABEL)} {draftRate.pair}: {formatCommercialRate(draftRate.rate)} ({t(DRAFT_RATE_NOTE)})
                  </Text>
                ) : null}

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
                        maxLength={SALE_OWN_TTN_MAX_LENGTH}
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
                        placeholder={t('Оберіть файл')}
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
                        href={toSameOriginDataUrl(sale.CustomersOwnTtn.TtnPDFPath)}
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
        localCurrencyCode={getSaleConvertedCurrencyCode(sale)}
        useEurToUah={isUahConvertedSale(sale)}
      />
      <WizardReviewConfirmModal opened={confirmOpened} onCancel={handleCancelClose} onConfirm={() => void handleConfirmClose()} />
    </Box>
  )
}
