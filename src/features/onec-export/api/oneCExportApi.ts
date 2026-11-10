import { ApiError, apiRequest, apiUrl, getApiLanguage, refreshAuthSession } from '../../../shared/api/apiClient'
import { clearSession, notifyUnauthorized, readSession } from '../../../shared/auth/session'
import { getTimeZoneHeader } from '../../../shared/date/dateTime'
import { translate } from '../../../shared/i18n/translate'

export const ONE_C_EXPORT_BASES = ['Fenix', 'Amg'] as const
export type OneCExportBase = (typeof ONE_C_EXPORT_BASES)[number]

export const ONE_C_EXPORT_BASE_LABELS: Record<OneCExportBase, string> = {
  Fenix: 'Фенікс',
  Amg: 'АМГ',
}

export const ONE_C_EXPORT_TYPES = [
  'Sale',
  'SaleReturn',
  'ProductIncome',
  'ProductTransfer',
  'WriteOff',
  'Capitalization',
  'IncomePayment',
  'OutgoingPayment',
  'RegisterTransfer',
  'CurrencyExchange',
  'ReSale',
  'ServiceIncome',
  'SupplyOrder',
] as const
export type OneCExportDocumentType = (typeof ONE_C_EXPORT_TYPES)[number]

export const ONE_C_EXPORT_UNCONFIRMED_TYPES: readonly OneCExportDocumentType[] = ['ServiceIncome', 'SupplyOrder']

export const ONE_C_EXPORT_TYPE_LABELS: Record<OneCExportDocumentType, string> = {
  Sale: 'Видаткові накладні',
  SaleReturn: 'Повернення від покупців',
  ProductIncome: 'Прихідні накладні',
  ProductTransfer: 'Переміщення товарів',
  WriteOff: 'Списання товарів',
  Capitalization: 'Оприбуткування товарів',
  IncomePayment: 'Надходження коштів (каса, банк)',
  OutgoingPayment: 'Витрата коштів (каса, банк)',
  RegisterTransfer: 'Переміщення коштів між рахунками',
  CurrencyExchange: 'Обмін валют',
  ReSale: 'Перепродаж',
  ServiceIncome: 'Послуги постачальників',
  SupplyOrder: 'Замовлення постачальникам',
}

export type OneCExportRequest = {
  bases: OneCExportBase[]
  from: string
  to: string | null
  types: OneCExportDocumentType[]
}

export type OneCExportWarning = {
  Code: string
  Skipped: boolean
  Type: OneCExportDocumentType | null
  NetUid: string | null
  Number: string | null
  Line: number | null
  Message: string
}

export type OneCExportRun = {
  NetUid: string
  BatchNetUid: string
  CreatedAtUtc: string
  UserName: string | null
  Base: OneCExportBase
  BaseName: string
  PeriodFrom: string
  PeriodTo: string
  DocumentTypes: string[]
  DocumentCount: number
  DeletedCount: number
  FirstCount: number
  ChangedCount: number
  FileName: string
  FileSha256: string | null
  FileLength: number
  SkippedCount?: number
  Warnings?: OneCExportWarning[]
}

export type DownloadedFile = {
  blob: Blob
  fileName: string
  batchNetUid: string | null
  warningCount: number
}

const BASE_PATH = '/integration/onec-export'
const EXPORT_TIMEOUT_MS = 10 * 60 * 1000
const REVOKE_DELAY_MS = 60 * 1000

export function getOneCExportRuns(limit = 50, signal?: AbortSignal): Promise<OneCExportRun[]> {
  return apiRequest<OneCExportRun[]>(`${BASE_PATH}/runs`, {
    query: { limit },
    signal,
    errorMessages: { default: 'Не вдалося завантажити журнал вивантажень' },
  })
}

export function exportToOneC(request: OneCExportRequest): Promise<DownloadedFile> {
  return downloadFile(`${BASE_PATH}/export`, 'POST', request, 'gba-1c.xml')
}

export function downloadOneCExportBatch(batchNetUid: string): Promise<DownloadedFile> {
  return downloadFile(`${BASE_PATH}/runs/${encodeURIComponent(batchNetUid)}/file`, 'GET', undefined, 'gba-1c.xml')
}

export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''))
    } catch {
      return fallback
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1].trim() : fallback
}

export function saveDownloadedFile(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

async function downloadFile(
  path: string,
  method: 'GET' | 'POST',
  body: unknown,
  fallbackName: string,
  allowRefresh = true,
): Promise<DownloadedFile> {
  const headers = new Headers(getTimeZoneHeader())
  const csrfToken = readSession()?.csrfToken
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(apiUrl(path, getApiLanguage()), {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(translate('Сервер не встиг сформувати файл. Оберіть коротший період або спробуйте пізніше.'), 0, null)
    }
    throw new ApiError(translate('Сервер недоступний. Спробуйте ще раз пізніше.'), 0, null)
  }

  if (response.status === 401 && allowRefresh) {
    const refreshed = await refreshAuthSession(readSession()?.accessTokenExpiresAt)
    if (refreshed) return downloadFile(path, method, body, fallbackName, false)
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearSession()
      notifyUnauthorized()
    }
    throw new ApiError(await readErrorMessage(response), response.status, null, response.headers)
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get('Content-Disposition'), fallbackName),
    batchNetUid: response.headers.get('X-Gba-Export-Batch'),
    warningCount: Number(response.headers.get('X-Gba-Export-Warnings') ?? 0) || 0,
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = translate('Не вдалося сформувати вивантаження в 1С')
  try {
    const text = await response.text()
    if (!text) return fallback
    const payload = JSON.parse(text) as { Message?: unknown; message?: unknown }
    const message = payload.Message ?? payload.message
    return typeof message === 'string' && message.trim() ? message : fallback
  } catch {
    return fallback
  }
}
