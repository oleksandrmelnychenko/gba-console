import { translate } from '../../shared/i18n/translate'
import type { Client } from './types'

export function getClientDisplayName(client: Client): string {
  const fullName = client.FullName?.trim() || client.Name?.trim()

  if (fullName) {
    return fullName
  }

  return [client.FirstName, client.LastName, client.MiddleName].filter(Boolean).join(' ') || translate('Без назви')
}

