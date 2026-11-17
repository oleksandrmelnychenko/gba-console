import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { devServerFsAllow } from '../vite.config'

const directories: string[] = []

function temporary(prefix: string) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  directories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('dev server /@fs/ allow list', () => {
  it('allows the target of a linked node_modules, so fonts are not refused with 403', () => {
    const shared = temporary('gba-shared-modules-')
    const checkout = temporary('gba-checkout-')
    symlinkSync(shared, join(checkout, 'node_modules'), 'junction')

    expect(devServerFsAllow(checkout)).toContain(shared)
  })

  it('adds nothing for a node_modules folder inside the checkout', () => {
    const checkout = temporary('gba-checkout-')
    mkdirSync(join(checkout, 'node_modules'))

    expect(devServerFsAllow(checkout)).toHaveLength(1)
  })
})
