import { upgradeHttpToHttps } from './upgradeHttpToHttps'

export function getDocumentHref(url: string | null | undefined): string {
  return upgradeHttpToHttps(url)
}
