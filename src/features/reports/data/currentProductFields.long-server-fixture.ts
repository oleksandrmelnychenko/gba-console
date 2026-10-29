import fixture from './currentProductFields.long-server-fixture.json'
export const longProductRequest = fixture.request
/** Retained server data; no reconstruction of snapshot identities or attribute values. */
export function longProductResponse(offset: 0 | 5) {
  return structuredClone(fixture[`page${offset}`])
}
