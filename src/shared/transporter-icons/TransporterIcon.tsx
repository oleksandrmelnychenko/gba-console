import { Bus, PackageCheck } from 'lucide-react'
import { toProxiedAssetUrl } from '../url/proxiedAssetUrl'
import { resolveTransporterLogo } from './transporterLogos'

type TransporterIconProps = {
  cssClass?: string | null
  imageUrl?: string | null
  name?: string
  size?: number
}

// Renders a carrier's icon: the bundled logo mapped from its legacy CssClass first (per-transporter
// ImageUrl often 404s against the dead asset host), then a custom uploaded ImageUrl, then a lucide icon
// for the icon-font carriers (bus / self-pickup). Returns null when there is nothing to show (e.g. a
// driver row with no logo), so callers can render it inline before the name without reserving space.
export function TransporterIcon({ cssClass, imageUrl, name = '', size = 22 }: TransporterIconProps) {
  const bundled = resolveTransporterLogo(cssClass, name)

  if (bundled) {
    return (
      <img
        alt={name}
        src={bundled}
        width={size}
        height={size}
        style={{ objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }}
      />
    )
  }

  const normalizedClass = cssClass?.trim()
  const normalizedName = normalizeTransporterName(name)

  // Legacy records for these two transporters can still carry an ImageUrl from the retired
  // asset host. Prefer their semantic icons so a stale URL cannot render as a broken image.
  if (normalizedClass === 'bus_item_class' || normalizedName === 'автобус' || normalizedName === 'bus') {
    return <Bus size={size} strokeWidth={1.5} style={{ flexShrink: 0 }} />
  }

  if (
    normalizedClass === 'self_checkout_item_class'
    || normalizedName === 'самовивіз'
    || normalizedName === 'самовывоз'
    || normalizedName === 'selfpickup'
  ) {
    return <PackageCheck size={size} strokeWidth={1.5} style={{ flexShrink: 0 }} />
  }

  const imageSrc = toProxiedAssetUrl(imageUrl?.trim())

  if (imageSrc) {
    return (
      <img
        alt={name}
        src={imageSrc}
        width={size}
        height={size}
        style={{ objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }}
      />
    )
  }

  return null
}

function normalizeTransporterName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('uk-UA')
    .replace(/[\s\-_'".,`’«»()]+/g, '')
}

// Convenience wrapper: the carrier icon inline before its name. Renders just the name when there is no
// icon, so it is a drop-in replacement for a bare name cell.
export function TransporterNameWithIcon({
  cssClass,
  imageUrl,
  name,
  size = 20,
}: TransporterIconProps & { name?: string }) {
  const displayName = name || ''

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <TransporterIcon cssClass={cssClass} imageUrl={imageUrl} name={displayName} size={size} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
    </span>
  )
}
