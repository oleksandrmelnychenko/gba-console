import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/api/apiClient'
import {
  formatEngineVolume,
  getVehicleRegistryFieldLabel,
  getVehicleRegistryImportErrorMessage,
  isInvalidEngineVolume,
} from './vehicleRegistryText'

describe('vehicle registry import texts', () => {
  it('shows Ukrainian column labels instead of raw field keys', () => {
    expect(getVehicleRegistryFieldLabel('manufactureYear', 'invalid_manufacture_year')).toBe('Рік випуску')
    expect(getVehicleRegistryFieldLabel('vin', 'invalid_vin_length')).toBe('VIN')
    expect(getVehicleRegistryFieldLabel('ownerName', 'missing_owner')).toBe('Власник')
    expect(getVehicleRegistryFieldLabel('plateNumber')).toBe('Держномер')
    expect(getVehicleRegistryFieldLabel(null, 'other_code')).toBe('other_code')
  })

  it('translates the English import rejections and the 500 fallback', () => {
    const cases: Array<[string, string, number, RegExp]> = [
      ['Excel file is required.', 'MISSING_FILE', 400, /Оберіть Excel-файл/],
      ['Workbook does not contain the required vehicle registry columns.', 'INVALID_VEHICLE_REGISTRY_FILE', 400, /обов’язкових колонок/],
      ['Only .xls and .xlsx vehicle registry files are supported.', 'INVALID_VEHICLE_REGISTRY_FILE', 400, /\.xls та \.xlsx/],
      ['Vehicle registry import failed.', 'VEHICLE_REGISTRY_IMPORT_FAILED', 500, /Не вдалося прочитати файл/],
    ]

    for (const [message, code, status, expected] of cases) {
      const error = new ApiError(message, status, { ErrorCode: code, Message: message })
      const text = getVehicleRegistryImportErrorMessage(error)

      expect(text).toMatch(expected)
      expect(text).not.toMatch(/[A-Za-z]{4,} [a-z]+/)
    }
  })

  it('keeps Ukrainian messages and hides unknown English ones', () => {
    expect(getVehicleRegistryImportErrorMessage(new Error('Сервер недоступний'))).toBe('Сервер недоступний')
    expect(getVehicleRegistryImportErrorMessage(new Error('Something odd happened'))).toMatch(/^Не вдалося імпортувати файл/)
  })

  it('flags a negative engine volume', () => {
    expect(isInvalidEngineVolume(-5)).toBe(true)
    expect(isInvalidEngineVolume(1600)).toBe(false)
    expect(formatEngineVolume(-5)).toBe('Некоректний об’єм: -5')
    expect(formatEngineVolume(1600)).toMatch(/1,6 л/)
    expect(formatEngineVolume(null)).toBe('—')
  })
})
