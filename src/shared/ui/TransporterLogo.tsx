import { Truck } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { upgradeHttpToHttps } from '../url/upgradeHttpToHttps'
import { toProxiedAssetUrl } from '../url/proxiedAssetUrl'
import { resolveTransporterLogo } from '../transporter-icons/transporterLogos'

const TRUCK_ICON_STYLE = { color: 'var(--mantine-color-gray-6)', flex: '0 0 auto' } as const

/**
 * Carrier logo that ALWAYS shows something: the transporter's image when it
 * loads, otherwise a truck icon. Rendering via <img onError> (instead of a CSS
 * background-image) is what guarantees the fallback — background-image has no
 * load-failure event, so a present-but-unreachable ImageUrl would otherwise
 * render a blank box. The URL is routed through toProxiedAssetUrl so the API's
 * internal-origin /Images/ URLs load via the same-origin proxy.
 */
export function TransporterLogo({
  className,
  cssClass,
  iconSize = 15,
  imageUrl,
  name,
  style,
}: {
  className?: string
  cssClass?: string | null
  iconSize?: number
  imageUrl?: string | null
  name?: string | null
  style?: CSSProperties
}) {
  const bundled = resolveTransporterLogo(cssClass, name)
  const src = bundled || upgradeHttpToHttps(toProxiedAssetUrl(imageUrl?.trim()))
  // Keyed by src so a new row's image clears a previous row's failure.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return <Truck size={iconSize} style={TRUCK_ICON_STYLE} />
  }

  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      src={src}
      style={{ objectFit: 'contain', ...style }}
      onError={() => setFailedSrc(src)}
    />
  )
}
