/** Company car limits shared with the server (CompanyCar columns and create/update validation). */
export const COMPANY_CAR_LIMITS = {
  carBrandMaxLength: 100,
  consumptionMax: 100,
  licensePlateMaxLength: 20,
  mileageMax: 10_000_000,
  tankCapacityMax: 2000,
} as const

export type CompanyCarFormValues = {
  carBrand: string
  fuelAmount: string
  inCityConsumption: string
  licensePlate: string
  mileage: string
  mixedModeConsumption: string
  outsideCityConsumption: string
  tankCapacity: string
}

export type CompanyCarFormErrors = Partial<Record<keyof CompanyCarFormValues, string>>

type Translate = (text: string) => string

/**
 * Reads a numeric form value. Empty → null, anything that is not a plain
 * decimal number («abc», «1e9», «1.2.3») → NaN, a decimal comma is accepted.
 */
export function parseCarNumber(value: string): number | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const normalized = trimmed.replace(',', '.')

  return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN
}

/**
 * Validates the car form like the server does. `requireFilled` adds the
 * «required» errors, which are only shown after a save attempt; range and
 * format errors are reported as soon as a value is typed.
 */
export function validateCompanyCarForm(
  values: CompanyCarFormValues,
  t: Translate,
  requireFilled: boolean,
): CompanyCarFormErrors {
  const errors: CompanyCarFormErrors = {}
  const licensePlate = values.licensePlate.trim()

  if (licensePlate.length > COMPANY_CAR_LIMITS.licensePlateMaxLength) {
    errors.licensePlate = t('№ авто не може бути довшим за 20 символів')
  } else if (requireFilled && !licensePlate) {
    errors.licensePlate = t('Вкажіть № авто')
  }

  if (values.carBrand.trim().length > COMPANY_CAR_LIMITS.carBrandMaxLength) {
    errors.carBrand = t('Марка автомобіля не може бути довшою за 100 символів')
  }

  const tankCapacity = parseCarNumber(values.tankCapacity)
  const tankError = checkNumber(tankCapacity, t, requireFilled, t('Вкажіть вмістимість баку'))
    || (tankCapacity !== null && tankCapacity <= 0 ? t('Вмістимість баку має бути більшою за 0') : '')
    || (tankCapacity !== null && tankCapacity > COMPANY_CAR_LIMITS.tankCapacityMax ? t('Вмістимість баку не може перевищувати 2000 л') : '')
  if (tankError) {
    errors.tankCapacity = tankError
  }

  const fuelAmount = parseCarNumber(values.fuelAmount)
  const fuelError = checkNumber(fuelAmount, t, requireFilled, t('Введіть кількість пального'))
    || (fuelAmount !== null && !tankError && tankCapacity !== null && fuelAmount > tankCapacity
      ? t('Кількість пального не може перевищувати вмістимість баку')
      : '')
  if (fuelError) {
    errors.fuelAmount = fuelError
  }

  const mileage = parseCarNumber(values.mileage)
  const mileageError = checkNumber(mileage, t, requireFilled, t('Введіть пробіг'))
    || (mileage !== null && mileage > COMPANY_CAR_LIMITS.mileageMax ? t('Показники одометра не можуть перевищувати 10 000 000 км') : '')
  if (mileageError) {
    errors.mileage = mileageError
  }

  for (const field of ['inCityConsumption', 'outsideCityConsumption', 'mixedModeConsumption'] as const) {
    const consumption = parseCarNumber(values[field])
    const consumptionError = checkNumber(consumption, t, false, '')
      || (consumption !== null && consumption > COMPANY_CAR_LIMITS.consumptionMax ? t('Розхід має бути від 0 до 100 л на 100 км') : '')
    if (consumptionError) {
      errors[field] = consumptionError
    }
  }

  return errors
}

/** Header metric: only a valid non-negative number is shown, never «abc» or «1e9». */
export function formatCarMetric(value: string): string {
  const parsed = parseCarNumber(value)

  return parsed === null || !Number.isFinite(parsed) || parsed < 0 ? '—' : String(parsed)
}

function checkNumber(value: number | null, t: Translate, requireFilled: boolean, requiredMessage: string): string {
  if (value === null) {
    return requireFilled ? requiredMessage : ''
  }

  if (!Number.isFinite(value)) {
    return t('Введіть число')
  }

  return value < 0 ? t('Значення не може бути від’ємним') : ''
}
