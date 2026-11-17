/** Column limits enforced again by the server (CustomersOwnTtn.Number, Sale.Comment). */
export const SALE_OWN_TTN_MAX_LENGTH = 150
export const SALE_COMMENT_MAX_LENGTH = 450

const OWN_TTN_PATTERN = /^[\p{L}\p{Nd}][\p{L}\p{Nd} /-]{5,39}$/u
const PHONE_PATTERN = /^\+?[0-9 ()-]+$/

/** Same rule as the server: 6..40 letters/digits/space/«-»/«/»; a digits-only number has 10..20 digits. */
export function isValidOwnTtnNumber(value: string | null | undefined): boolean {
  const number = value?.trim() ?? ''
  if (!number) return true
  if (!OWN_TTN_PATTERN.test(number)) return false
  return !/^\d+$/.test(number) || (number.length >= 10 && number.length <= 20)
}

/** Same rule as the server: 10..15 digits; only +, spaces, brackets and «-» besides digits. */
export function isValidRecipientPhone(value: string | null | undefined): boolean {
  const phone = value?.trim() ?? ''
  if (!phone) return true
  const digits = phone.replace(/\D/g, '').length
  return PHONE_PATTERN.test(phone) && digits >= 10 && digits <= 15
}

export const OWN_TTN_FORMAT_MESSAGE = 'Номер ТТН: від 6 до 40 символів (цифри, літери, пробіл, «-» або «/»); номер лише з цифр — від 10 до 20 цифр'
export const RECIPIENT_PHONE_FORMAT_MESSAGE = 'Мобільний телефон одержувача має містити від 10 до 15 цифр (дозволено +, пробіли, дужки та «-»)'
