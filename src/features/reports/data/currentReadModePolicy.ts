import { isProfitReadModeCapability, requestProfitReadMode } from './profitReadMode'
import { isCashReadModeCapability, requestCashReadMode } from './cashReadMode'
import { isSettlementReadModeCapability, requestSettlementReadMode } from './settlementReadMode'
import type { ReportDataset, ReportRequestBody } from '../types'

export const TEMPLATE_WITHOUT_READ_MODE_ERROR = 'Шаблон збережено без джерела розрахунку, а його налаштування не підтримуються для «Поточних документів GBA». Шаблон потребує повторного збереження: налаштуйте форму заново і збережіть шаблон.'
export const SAVED_VARIANT_WITHOUT_READ_MODE_ERROR = 'Шаблон збережено без джерела розрахунку, тож сервер сформував би його за старими налаштуваннями. Шаблон потребує повторного збереження: відкрийте його у формі (буде застосовано «Поточні документи GBA») і збережіть.'

function legacyInference(capability: unknown): boolean {
  if (!capability || typeof capability !== 'object') return false
  const key = Object.keys(capability).find(name => name.toLowerCase() === 'legacyinferencepreserved')
  return key !== undefined && (capability as Record<string, unknown>)[key] === true
}

export function lacksCurrentReadMode(data: ReportRequestBody, dataset?: ReportDataset): boolean {
  if (!dataset || dataset.DataSource !== data.dataSource) return false
  if (!legacyInference(dataset.profitReadMode ?? dataset.cashReadMode ?? dataset.settlementReadMode)) return false
  if (data.dataSource === 35 || data.dataSource === 38)
    return isProfitReadModeCapability(dataset.profitReadMode) && requestProfitReadMode(data) == null
  if (data.dataSource === 40) return isCashReadModeCapability(dataset.cashReadMode) && requestCashReadMode(data) == null
  if (data.dataSource === 41)
    return isSettlementReadModeCapability(dataset.settlementReadMode) && requestSettlementReadMode(data) == null
  return false
}
