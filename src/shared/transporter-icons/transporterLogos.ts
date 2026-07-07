import autolux from './logos/autolux.png'
import delivery from './logos/delivery.png'
import gunsel from './logos/gunsel.png'
import intime from './logos/intime.png'
import meestExpress from './logos/meest_express.png'
import nightExpress from './logos/night_express.png'
import novaPosta from './logos/nova_posta.png'
import sat from './logos/sat.png'

// Bundled carrier logos keyed by the transporter's legacy CssClass. Ported from the legacy sprite
// (transporters_max.png) because the per-transporter ImageUrl values point at a decommissioned asset
// host and 404, leaving Нова пошта / Гюнсел / etc. with no icon.
export const CARRIER_LOGO_BY_CSS_CLASS: Record<string, string> = {
  sat_item_class: sat,
  autolux_item_class: autolux,
  gunsel_item_class: gunsel,
  delivery_item_class: delivery,
  nova_posta_item_class: novaPosta,
  night_express_item_class: nightExpress,
  intime_item_class: intime,
  meest_express_item_class: meestExpress,
}

export function resolveTransporterLogo(cssClass?: string | null): string | undefined {
  if (!cssClass) {
    return undefined
  }

  return CARRIER_LOGO_BY_CSS_CLASS[cssClass.trim()]
}
