import { upgradeHttpToHttps } from './upgradeHttpToHttps'

/* Server documents under /Data/ (for example customer TTN uploads,
   /Data/Temp/CustomersTTN-*) need the signed-in session. The API returns them
   as absolute URLs on its own origin (GBA_CRM_SERVER_URL or the proxied host),
   where the console's host-only auth cookie is never sent, so opening them
   there answers 401. Rewrite an absolute /Data/ URL to a same-origin path:
   the vite dev server and the production nginx both proxy /Data/ to the API
   with the cookie. Signed report links keep their query string. Anything else
   is only upgraded to https when the console runs on https. */
export function toSameOriginDataUrl(url: string | null | undefined): string {
  const value = url?.trim()

  if (!value) {
    return ''
  }

  const match = /^https?:\/\/[^/?#]+(\/Data\/[^#]*)(#.*)?$/i.exec(value)

  return match ? match[1] + (match[2] ?? '') : upgradeHttpToHttps(value)
}
