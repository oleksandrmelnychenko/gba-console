import { Bus, PackageCheck } from 'lucide-react'
import { toProxiedAssetUrl } from '../url/proxiedAssetUrl'
import { resolveTransporterLogo } from './transporterLogos'
import { getSemanticTransporterIcon } from './transporterSemantics'

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
  const semanticIcon = getSemanticTransporterIcon(cssClass, name)

  if (semanticIcon === 'bus') {
    return <Bus size={size} strokeWidth={1.5} style={{ flexShrink: 0 }} />
  }

  if (semanticIcon === 'self-pickup') {
    return <PackageCheck size={size} strokeWidth={1.5} style={{ flexShrink: 0 }} />
  }

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
