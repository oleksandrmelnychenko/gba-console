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
