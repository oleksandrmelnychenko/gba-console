/** Road list limits shared with the server create/update validation. */
export const ROAD_LIST_LIMITS = {
  commentMaxLength: 150,
  kilometersMax: 100_000,
  mileageMax: 10_000_000,
} as const

export type RoadListFormValues = {
  comment: string
  inCityKilometers: string
  mileage: string
  mixedModeKilometers: string
  outsideCityKilometers: string
}

export type RoadListFormErrors = Partial<Record<keyof RoadListFormValues | 'drivers', string>>

type Translate = (text: string) => string

/** Whole kilometres: empty → null, «12» → 12, anything else («abc», «-5», «2,5») → NaN. */
export function parseWholeKilometers(value: string): number | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN
}

/**
 * Validates the road list like the server: odometer 1..10 000 000, distances
 * whole 0..100 000 km, comment up to 150 characters, at least one recipient
 * («Кому видано»). Required-field errors only appear when `requireFilled`.
 */
export function validateRoadListForm(
  values: RoadListFormValues,
  driversCount: number,
  t: Translate,
  requireFilled: boolean,
): RoadListFormErrors {
  const errors: RoadListFormErrors = {}

  const mileageError = describeKilometers(values.mileage, t)
    || (parseWholeKilometers(values.mileage) === null && requireFilled ? t('Вкажіть показники одометра') : '')
    || rangeError(parseWholeKilometers(values.mileage), 1, ROAD_LIST_LIMITS.mileageMax, t('Показники одометра мають бути від 1 до 10 000 000 км'))
  if (mileageError) {
    errors.mileage = mileageError
  }

  for (const field of ['inCityKilometers', 'outsideCityKilometers', 'mixedModeKilometers'] as const) {
    const fieldError = describeKilometers(values[field], t)
      || rangeError(parseWholeKilometers(values[field]), 0, ROAD_LIST_LIMITS.kilometersMax, t('Кілометраж має бути від 0 до 100 000 км'))
    if (fieldError) {
      errors[field] = fieldError
    }
  }

  if (values.comment.length > ROAD_LIST_LIMITS.commentMaxLength) {
    errors.comment = t('Коментар не може бути довшим за 150 символів')
  }

  if (requireFilled && driversCount === 0) {
    errors.drivers = t('Вкажіть, кому видано шляховий лист')
  }

  return errors
}

export function hasRoadListFormatErrors(errors: RoadListFormErrors): boolean {
  return Boolean(errors.mileage || errors.inCityKilometers || errors.outsideCityKilometers || errors.mixedModeKilometers)
}

function describeKilometers(value: string, t: Translate): string {
  const parsed = parseWholeKilometers(value)

  if (parsed === null || Number.isFinite(parsed)) {
    return ''
  }

  const normalized = value.trim().replace(',', '.')

  if (/^-\d+([.]\d+)?$/.test(normalized)) {
    return t('Значення не може бути від’ємним')
  }

  return /^\d+[.]\d+$/.test(normalized) ? t('Введіть ціле число кілометрів') : t('Введіть число')
}

function rangeError(value: number | null, min: number, max: number, message: string): string {
  return value !== null && Number.isFinite(value) && (value < min || value > max) ? message : ''
}
