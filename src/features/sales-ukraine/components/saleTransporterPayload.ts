import type { SalesUkraineSale, SalesUkraineTransporter } from '../types'

export function applySaleTransporterIdentity(
  sale: SalesUkraineSale,
  transporter: SalesUkraineTransporter | null | undefined,
): SalesUkraineSale {
  return {
    ...sale,
    Transporter: transporter ?? undefined,
    TransporterId: transporter?.Id,
  }
}
