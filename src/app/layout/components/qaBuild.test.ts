import { expect, it } from 'vitest'
import { buildOrder, isNewerBuild } from './qaBuild'

it('orders QA build numbers by date and time and rejects unreadable ones', () => {
  expect(buildOrder('2026.10.15.2236')).toBe(202610152236)
  expect([undefined, null, '', 'dev', '2026.10.15', '2026.10.15.22:36', 202610152236].map(buildOrder))
    .toEqual([null, null, null, null, null, null, null])
})

it('treats only a strictly later QA Desk release as a new deployment', () => {
  expect(isNewerBuild('2026.10.06.2301', '2026.10.15.2236')).toBe(false)
  expect(isNewerBuild('2026.10.15.2236', '2026.10.15.2236')).toBe(false)
  expect(isNewerBuild('2026.10.16.0005', '2026.10.15.2236')).toBe(true)
  expect(isNewerBuild('2026.10.16.0005', 'local')).toBe(false)
  expect(isNewerBuild('broken', '2026.10.15.2236')).toBe(false)
})
