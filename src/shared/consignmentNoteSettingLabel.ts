import { translate } from './i18n/translate'

type ConsignmentNoteSettingLike = {
  BrandAndNumberCar?: string | null
  Carrier?: string | null
  Customer?: string | null
  Driver?: string | null
  LoadingPoint?: string | null
  Name?: string | null
  Number?: string | null
  TrailerNumber?: string | null
  UnloadingPoint?: string | null
}

/**
 * Label of a saved «Друк ТТН» setting in the «Існуючі налаштування» list, or null for an empty template.
 * The local database holds 14 settings created (before the server started requiring a name, 17.11.2026)
 * with nothing filled in: they were listed as 14 identical «Без назви» entries, and choosing one fills
 * nothing. A nameless setting that has data is named after it.
 */
export function consignmentNoteSettingLabel(setting: ConsignmentNoteSettingLike): string | null {
  const name = setting.Name?.trim()
  if (name) return name

  const details = [
    setting.Number?.trim() ? `№ ${setting.Number.trim()}` : '',
    setting.BrandAndNumberCar,
    setting.TrailerNumber,
    setting.Driver,
    setting.Carrier,
    setting.Customer,
    setting.LoadingPoint,
    setting.UnloadingPoint,
  ]
    .map((value) => value?.trim() || '')
    .filter(Boolean)
    .join(', ')

  return details ? `${translate('Без назви')} (${details})` : null
}
