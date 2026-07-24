export const ACCOUNTING_COMMENT_MAX_LENGTH = 450
export const ACCOUNTING_DOCUMENT_PAYMENT_MAX_DAYS = 180
export const ACCOUNTING_SAFE_MONEY_MAX_VALUE = Math.floor(Number.MAX_SAFE_INTEGER / 100)
export const EXTERNAL_DOCUMENT_PAYMENT_CURRENCY_CODE = 'PLN'

type ExternalDocumentCurrencyRegister = {
  Currency?: {
    Code?: string
  } | null
}

type ExternalDocumentPaymentRegister<TCurrencyRegister extends ExternalDocumentCurrencyRegister> = {
  PaymentCurrencyRegisters?: TCurrencyRegister[] | null
}

export type PersistedEntityReference = {
  Id?: number
  NetUid?: string
}

export type PartnerAgreementPayload<
  TClientAgreement extends PersistedEntityReference,
  TOrganizationClientAgreement extends PersistedEntityReference,
> =
  | {
      ClientAgreement: TClientAgreement
      OrganizationClientAgreement?: never
    }
  | {
      ClientAgreement?: never
      OrganizationClientAgreement: TOrganizationClientAgreement
    }

export function buildPartnerAgreementPayload<
  TClientAgreement extends PersistedEntityReference,
  TOrganizationClientAgreement extends PersistedEntityReference,
>(
  clientAgreement?: TClientAgreement | null,
  organizationClientAgreement?: TOrganizationClientAgreement | null,
): PartnerAgreementPayload<TClientAgreement, TOrganizationClientAgreement> | null {
  const persistedClientAgreement = isPersistedEntity(clientAgreement) ? clientAgreement : null
  const persistedOrganizationClientAgreement = isPersistedEntity(organizationClientAgreement)
    ? organizationClientAgreement
    : null

  if (Boolean(persistedClientAgreement) === Boolean(persistedOrganizationClientAgreement)) {
    return null
  }

  return persistedClientAgreement
    ? { ClientAgreement: persistedClientAgreement }
    : { OrganizationClientAgreement: persistedOrganizationClientAgreement as TOrganizationClientAgreement }
}

export function getExternalDocumentPaymentDateBounds(
  documentDate?: Date | string,
): { max: string; min: string } | null {
  if (!documentDate) {
    return null
  }

  const minDate = new Date(documentDate)

  if (Number.isNaN(minDate.getTime())) {
    return null
  }

  const maxDate = new Date(minDate)
  maxDate.setDate(maxDate.getDate() + ACCOUNTING_DOCUMENT_PAYMENT_MAX_DAYS)

  return {
    max: toLocalDateInput(maxDate),
    min: toLocalDateInput(minDate),
  }
}

export function pickExternalDocumentPaymentCurrencyRegister<
  TCurrencyRegister extends ExternalDocumentCurrencyRegister,
>(
  register?: ExternalDocumentPaymentRegister<TCurrencyRegister> | null,
): TCurrencyRegister | null {
  return register?.PaymentCurrencyRegisters?.find(
    (currencyRegister) =>
      currencyRegister.Currency?.Code?.trim().toUpperCase()
      === EXTERNAL_DOCUMENT_PAYMENT_CURRENCY_CODE,
  ) || null
}

export function isSupportedAccountingAmount(value: number, requirePositive = true): boolean {
  const cents = Math.round(value * 100)

  return Number.isFinite(value)
    && value <= ACCOUNTING_SAFE_MONEY_MAX_VALUE
    && (requirePositive ? value > 0 : value >= 0)
    && Number.isSafeInteger(cents)
    && cents / 100 === value
}

export function isSupportedVat(amount: number, vatAmount: number, vatPercent: number): boolean {
  return isSupportedAccountingAmount(vatAmount, false)
    && Number.isFinite(vatPercent)
    && vatPercent >= 0
    && vatPercent <= 100
    && vatAmount <= amount
}

function isPersistedEntity<TReference extends PersistedEntityReference>(
  entity?: TReference | null,
): entity is TReference {
  return typeof entity?.Id === 'number' && Number.isSafeInteger(entity.Id) && entity.Id > 0
}

function toLocalDateInput(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}
