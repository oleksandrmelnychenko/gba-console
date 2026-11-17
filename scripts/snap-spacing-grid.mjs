#!/usr/bin/env node
// Snaps spacing / radius literals onto the 4px grid (docs/ui-spacing-grid.md).
// Usage: node scripts/snap-spacing-grid.mjs [--dry] <file-or-dir> [...]
//
// CSS: padding*, margin*, gap, row-gap, column-gap, border-radius* (px literals only).
// TSX: Mantine numeric spacing props (gap/p/px/py/pt/pb/pl/pr/m/mx/my/mt/mb/ml/mr/
//      rowGap/columnGap/spacing/verticalSpacing/horizontalSpacing/radius={N}).
// Sizes are NOT touched unless --sizes is passed (then width/height/min-*/max-* ≥ 24px): they are often coupled to JS
// constants (row heights, virtualizer sizes, sticky offsets) and are reviewed by hand.
//
// Mapping: nearest multiple of 4. Ties (6, 10, 14, 18 …) round DOWN to keep the
// console dense, except 6 → 8 (6px is the structural gutter; 4px stays for
// tight intra-control gaps). 0/1/2px, 999px+ pills and %/rem values are kept.
// A declaration ending with `/* grid-exempt */` is skipped.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function snap(n) {
  const a = Math.abs(n)
  if (a <= 2 || a >= 999 || a % 4 === 0) return n
  if (!Number.isInteger(a)) return n
  let r
  if (a === 6) r = 8
  else if (a % 4 === 2) r = a - 2
  else r = Math.round(a / 4) * 4
  return Math.sign(n) * r
}

const SIZE_PROP = /^(min-|max-)?(width|height)$/
const CSS_PROP = /^(padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(gap|row-gap|column-gap)$|^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/
const TSX_PROPS = 'gap|p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|rowGap|columnGap|spacing|verticalSpacing|horizontalSpacing|radius'
const TSX_RE = new RegExp(`(\\s(?:${TSX_PROPS}))=\\{(-?\\d+)\\}`, 'g')

function snapCss(text, sizes = false) {
  let count = 0
  const out = text.replace(/(^|[{;\s])([a-z-]+)(\s*:\s*)([^;{}]+)(;)/gm, (all, pre, prop, colon, value, semi, offset, src) => {
    const isSize = sizes && SIZE_PROP.test(prop)
    if (!CSS_PROP.test(prop) && !isSize) return all
    const tail = src.slice(offset + all.length, offset + all.length + 40)
    if (/^\s*\/\*\s*grid-exempt/.test(tail)) return all
    const next = value.replace(/(-?\d+)px/g, (m, num) => {
      const n = parseInt(num, 10)
      const s = isSize && Math.abs(n) < 24 ? n : snap(n)
      if (s !== n) count++
      return `${s}px`
    })
    return `${pre}${prop}${colon}${next}${semi}`
  })
  return { out, count }
}

function snapTsx(text) {
  let count = 0
  const out = text.replace(TSX_RE, (all, prop, num) => {
    const s = snap(parseInt(num, 10))
    if (s === parseInt(num, 10)) return all
    count++
    return `${prop}={${s}}`
  })
  return { out, count }
}

// Files another branch (fix/rbac-frontend-permissions) is editing: never rewrite them.
const PROTECTED = /(?:^|[\\/])(UserRolesPage|RoleFormModal|ConsoleNav|NavigationProvider|ClientEditPage|ClientAgreementsPanel|ProductDeliveryProtocolIncomePage)\.tsx$/

function walk(p, out = []) {
  const s = statSync(p)
  if (s.isDirectory()) for (const n of readdirSync(p)) walk(join(p, n), out)
  else if (/\.(css|tsx)$/.test(p) && !/\.test\.tsx$/.test(p) && !PROTECTED.test(p)) out.push(p)
  return out
}

if (process.argv[1]?.endsWith('snap-spacing-grid.mjs')) {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const sizes = args.includes('--sizes')
  const targets = args.filter((a) => !a.startsWith('--'))
  let total = 0
  for (const t of targets) {
    for (const file of walk(t)) {
      const text = readFileSync(file, 'utf8')
      const { out, count } = file.endsWith('.css') ? snapCss(text, sizes) : snapTsx(text)
      if (count) {
        total += count
        console.log(String(count).padStart(4), file)
        if (!dry) writeFileSync(file, out)
      }
    }
  }
  console.log('snapped values:', total, dry ? '(dry run)' : '')
}
