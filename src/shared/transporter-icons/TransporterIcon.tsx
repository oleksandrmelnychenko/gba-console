import { IconBus, IconWalk } from '@tabler/icons-react'
import { toProxiedAssetUrl } from '../url/proxiedAssetUrl'
import { resolveTransporterLogo } from './transporterLogos'

type TransporterIconProps = {
  cssClass?: string | null
  imageUrl?: string | null
  name?: string
  size?: number
}

// Renders a carrier's icon: the bundled logo mapped from its legacy CssClass first (per-transporter
// ImageUrl often 404s against the dead asset host), then a custom uploaded ImageUrl, then a Tabler icon
// for the icon-font carriers (bus / self-checkout). Returns null when there is nothing to show (e.g. a
// driver row with no logo), so callers can render it inline before the name without reserving space.
export function TransporterIcon({ cssClass, imageUrl, name = '', size = 22 }: TransporterIconProps) {
  const bundled = resolveTransporterLogo(cssClass)
  const imageSrc = bundled || toProxiedAssetUrl(imageUrl?.trim())

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

  const normalizedClass = cssClass?.trim()

  if (normalizedClass === 'bus_item_class') {
    return <IconBus size={size} stroke={1.5} style={{ flexShrink: 0 }} />
  }

  if (normalizedClass === 'self_checkout_item_class') {
    return <IconWalk size={size} stroke={1.5} style={{ flexShrink: 0 }} />
  }

  return null
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
