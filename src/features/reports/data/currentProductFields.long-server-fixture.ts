import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import fixture from './currentProductFields.long-server-fixture.json'
import type productFixture from './currentProductFields.server-fixture.json'
export const longProductRequest = fixture.request
/** Exact retained server bytes; no client-side reconstruction of snapshot identities or data. */
export function longProductResponse(offset: 0 | 5): typeof productFixture.page0 {
  const saved = fixture[`page${offset}`], bytes = gunzipSync(Buffer.from(saved.gzipBase64, 'base64'))
  if (createHash('sha256').update(bytes).digest('hex') !== saved.sha256) throw new Error('Corrupt retained server test fixture')
  return JSON.parse(bytes.toString('utf8')) as typeof productFixture.page0
}
