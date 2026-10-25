import { apiRequest } from '../../../shared/api/apiClient'
import { currencyCode, currencyNetUid } from '../data/reportPresentationCurrency'
export type ReportCurrencyOption = { value: string; code: string; label: string }
export async function getReportPresentationCurrencies(signal?: AbortSignal): Promise<ReportCurrencyOption[]> {
  const payload = await apiRequest<unknown>('/currencies/all', { signal })
  const envelope = payload && typeof payload === 'object' ? payload as Record<string, unknown> : undefined
  const rows = Array.isArray(payload) ? payload : envelope?.Items ?? envelope?.Currencies ?? envelope?.Data
  if (!Array.isArray(rows)) throw new Error('Не вдалося прочитати довідник валют.')
  const seen = new Set<string>()
  return rows.flatMap((row: unknown) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Некоректний запис довідника валют.')
    const item = row as Record<string, unknown>
    if (item.Deleted === true) return []
    if (!currencyNetUid(item.NetUid) || !currencyCode(item.Code)) throw new Error('Некоректний запис довідника валют.')
    const id = item.NetUid.toLowerCase()
    if (seen.has(id)) throw new Error('Довідник містить неоднозначну валюту.')
    seen.add(id)
    const name = typeof item.Name === 'string' ? item.Name.trim() : ''
    return [{ value: id, code: item.Code, label: name && name !== item.Code ? `${item.Code} — ${name}` : item.Code }]
  })
}
