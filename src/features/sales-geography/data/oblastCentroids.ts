export type OblastCentroid = {
  name: string
  lat: number
  lng: number
}

// Oblast code -> Ukrainian display name + centroid (lat, lng). These are the only
// codes we plot; any RegionCode not present here is treated as foreign / occupied
// noise and bucketed under «Інше» (see SalesGeographyPage).
export const OBLAST_CENTROIDS: Record<string, OblastCentroid> = {
  XM: { name: 'Хмельницька', lat: 49.42, lng: 26.99 },
  KI: { name: 'Київ', lat: 50.45, lng: 30.52 },
  OD: { name: 'Одеська', lat: 46.48, lng: 30.73 },
  RI: { name: 'Рівненська', lat: 50.62, lng: 26.25 },
  DP: { name: 'Дніпропетровська', lat: 48.46, lng: 35.04 },
  TE: { name: 'Тернопільська', lat: 49.55, lng: 25.59 },
  XV: { name: 'Харківська', lat: 49.99, lng: 36.23 },
  VI: { name: 'Вінницька', lat: 49.23, lng: 28.47 },
  LV: { name: 'Львівська', lat: 49.84, lng: 24.03 },
  MI: { name: 'Миколаївська', lat: 46.97, lng: 31.99 },
  VL: { name: 'Волинська', lat: 50.75, lng: 25.34 },
  CK: { name: 'Черкаська', lat: 49.44, lng: 32.06 },
  GT: { name: 'Житомирська', lat: 50.25, lng: 28.66 },
  KD: { name: 'Кіровоградська', lat: 48.51, lng: 32.26 },
  PA: { name: 'Полтавська', lat: 49.59, lng: 34.55 },
  IF: { name: 'Івано-Франківська', lat: 48.92, lng: 24.71 },
  CE: { name: 'Чернівецька', lat: 48.29, lng: 25.94 },
  SM: { name: 'Сумська', lat: 50.91, lng: 34.8 },
  ZK: { name: 'Закарпатська', lat: 48.62, lng: 22.29 },
  ZP: { name: 'Запорізька', lat: 47.84, lng: 35.14 },
  CN: { name: 'Чернігівська', lat: 51.49, lng: 31.29 },
  DN: { name: 'Донецька', lat: 48.02, lng: 37.8 },
  XN: { name: 'Херсонська', lat: 46.64, lng: 32.61 },
  LK: { name: 'Луганська', lat: 48.57, lng: 39.31 },
  KR: { name: 'Крим', lat: 44.95, lng: 34.1 },
  '200': { name: 'Крим', lat: 44.95, lng: 34.1 },
}

// Equirectangular projection over the Ukraine bbox. Used by BOTH the national
// outline and the centroid bubbles so they share one coordinate system.
//   lng 22.0 .. 40.3  -> x 0 .. W
//   lat 52.4 .. 44.3  -> y 0 .. H   (lat inverted: north at top)
export const UA_BBOX = {
  lngMin: 22.0,
  lngMax: 40.3,
  latTop: 52.4,
  latBottom: 44.3,
}

export function projectLng(lng: number, width: number): number {
  return ((lng - UA_BBOX.lngMin) / (UA_BBOX.lngMax - UA_BBOX.lngMin)) * width
}

export function projectLat(lat: number, height: number): number {
  return ((UA_BBOX.latTop - lat) / (UA_BBOX.latTop - UA_BBOX.latBottom)) * height
}

// Coarse national border of Ukraine as [lng, lat] waypoints (clockwise). This is a
// recognizable simplified outline used purely as backdrop for the bubbles — it is
// NOT oblast-accurate. Projected with the same UA_BBOX transform above.
export const UA_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [22.15, 48.4],
  [22.55, 49.08],
  [23.5, 50.4],
  [24.1, 50.86],
  [23.6, 51.53],
  [24.4, 51.9],
  [25.8, 51.92],
  [27.2, 51.75],
  [28.7, 51.55],
  [30.55, 51.32],
  [31.78, 52.1],
  [33.2, 52.36],
  [34.4, 51.25],
  [35.4, 50.5],
  [36.6, 50.25],
  [38.2, 49.95],
  [40.2, 49.6],
  [39.8, 48.9],
  [39.7, 47.85],
  [38.3, 47.6],
  [38.2, 47.1],
  [37.5, 47.05],
  [36.7, 46.7],
  [35.0, 46.6],
  [33.6, 46.15],
  [33.0, 46.55],
  [31.5, 46.6],
  [31.8, 46.0],
  [30.8, 46.05],
  [30.2, 45.4],
  [29.6, 45.35],
  [28.95, 45.95],
  [28.2, 45.45],
  [28.1, 46.4],
  [29.2, 47.45],
  [27.8, 48.45],
  [26.6, 48.25],
  [25.3, 47.9],
  [24.9, 47.72],
  [23.2, 47.99],
  [22.9, 47.95],
  [22.15, 48.4],
]
