import { TableChip } from '../../../shared/ui/TableChip'
import { formatMoney } from './protocolDetailHelpers'

export function ProtocolMoneyValue({ value, currency }: { value: number | null | undefined; currency?: string | null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <span>{formatMoney(value)}</span>{' '}
      {currency && <TableChip tone="source" value={currency} />}
    </span>
  )
}
