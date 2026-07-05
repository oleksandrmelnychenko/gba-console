/* The API sometimes returns absolute asset URLs pointing at its internal
   origin (e.g. https://85.17.167.167:20001/Images/...), which the browser
   cannot reach. Rewrite any absolute /Images/ URL to a same-origin relative
   path so it flows through the console proxy — both the vite dev server and
   the production nginx proxy /Images/ to the API. Other URLs pass through. */
export function toProxiedAssetUrl(url: string | null | undefined): string {
  if (!url) {
    return ''
  }

  const match = /^https?:\/\/[^/]+(\/Images\/.+)$/i.exec(url)

  return match ? match[1] : url
}
