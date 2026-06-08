import type { ProtocolDetail } from './detailTypes'

export function getProtocolStatusLabel(
  protocol: Pick<ProtocolDetail, 'IsCompleted' | 'IsShipped'>,
  t: (value: string) => string,
): string {
  if (protocol.IsCompleted) {
    return t('Завершено')
  }

  if (protocol.IsShipped) {
    return t('Прибув')
  }

  return t('В дорозі')
}

export function getProtocolStatusActionLabel(
  protocol: Pick<ProtocolDetail, 'IsCompleted' | 'IsShipped'>,
  t: (value: string) => string,
): string {
  return getProtocolStatusLabel(protocol, t)
}

export function getProtocolPlacementStatusLabel(
  protocol: Pick<ProtocolDetail, 'IsPartiallyPlaced' | 'IsPlaced'>,
  t: (value: string) => string,
): string {
  if (protocol.IsPlaced) {
    return t('Оприходуваний')
  }

  if (protocol.IsPartiallyPlaced) {
    return t('Частково оприходуваний')
  }

  return t('Не оприходуваний')
}
