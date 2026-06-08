import { SupplyExtraChargeType, type MergedService } from './detailTypes'

type Translate = (value: string) => string

export function getMergedServiceCalculationLabel(
  service: Pick<MergedService, 'IsAutoCalculatedValue' | 'IsCalculatedValue' | 'SupplyExtraChargeType'>,
  t: Translate,
): string | null {
  if (!service.IsCalculatedValue) {
    return null
  }

  if (!service.IsAutoCalculatedValue) {
    return t('Розраховано вручну')
  }

  if (service.SupplyExtraChargeType === SupplyExtraChargeType.Weight) {
    return t('Розраховано по вазі')
  }

  if (service.SupplyExtraChargeType === SupplyExtraChargeType.Volume) {
    return t("Розраховано по об'єму")
  }

  return t('Розраховано по ціні')
}
