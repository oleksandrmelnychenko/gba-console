import type { SaleConsignmentNoteSetting } from '../types'

export const CONSIGNMENT_NUMBER_MAX_LENGTH = 50
export const MAX_DIMENSION_MM = 100_000
export const MAX_WEIGHT_T = 1_000
export const DIMENSION_INPUT_PROPS = { allowDecimal: false, allowNegative: false, clampBehavior: 'strict', hideControls: true, max: MAX_DIMENSION_MM, min: 0 } as const
export const WEIGHT_INPUT_PROPS = { allowNegative: false, clampBehavior: 'strict', decimalScale: 2, hideControls: true, max: MAX_WEIGHT_T, min: 0 } as const

/**
 * Every stored field is loaded back (TTN number and loading point included). Only when the setting has no
 * stored number, the number typed for this document (or the document default P<sale number>) is used.
 */
export function applyConsignmentDocumentDefaults(
  setting: SaleConsignmentNoteSetting,
  defaults: SaleConsignmentNoteSetting,
  currentNumber?: string | null,
): SaleConsignmentNoteSetting {
  return {
    ...defaults,
    ...setting,
    LoadingPoint: setting.LoadingPoint || defaults.LoadingPoint,
    Number: setting.Number || currentNumber || defaults.Number,
  }
}

export function getConsignmentValidationError(setting: SaleConsignmentNoteSetting, t: (value: string) => string): string | null {
  if (!setting.Name) {
    return t('Вкажіть назву')
  }

  if (!setting.BrandAndNumberCar) {
    return t('Вкажіть марку та номер автомобіля')
  }

  if (!setting.Driver) {
    return t('Вкажіть водія')
  }

  if (!setting.LoadingPoint) {
    return t('Вкажіть пункт завантаження')
  }

  if (!setting.UnloadingPoint) {
    return t('Вкажіть пункт розвантаження')
  }

  if ((setting.Number ?? '').length > CONSIGNMENT_NUMBER_MAX_LENGTH) {
    return t('Номер ТТН не може бути довшим за 50 символів')
  }

  const dimensions = [setting.CarLength, setting.CarWidth, setting.CarHeight, setting.TrailerLength, setting.TrailerWidth, setting.TrailerHeight]

  if (dimensions.some((value) => !Number.isFinite(value ?? 0) || (value ?? 0) < 0 || (value ?? 0) > MAX_DIMENSION_MM)) {
    return t('Розміри мають бути від 0 до 100000 мм')
  }

  const weights = [setting.CarNetWeight, setting.CarGrossWeight, setting.TrailerNetWeight, setting.TrailerGrossWeight]

  if (weights.some((value) => !Number.isFinite(value ?? 0) || (value ?? 0) < 0 || (value ?? 0) > MAX_WEIGHT_T)) {
    return t('Вага має бути від 0 до 1000 т')
  }

  return null
}
