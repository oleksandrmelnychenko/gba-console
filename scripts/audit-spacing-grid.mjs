#!/usr/bin/env node
// Audits src/**/*.css for spacing / radius / size values that are off the 4px grid.
// Usage: node scripts/audit-spacing-grid.mjs [--json] [--files] [path-prefix]
// Checked properties: padding*, margin*, gap, row-gap, column-gap, border-radius*,
// inset/top/right/bottom/left, width/height/min-*/max-* (px only).
// Allowed: 0, 1px, 2px (hairlines / borders / focus offsets), 999px+ pills, 50%, multiples of 4.
// Exempt: sizes/offsets below 24px (icon glyphs, status dots, optical nudges) and any
// declaration followed by a `/* grid-exempt: reason */` comment.
// --check exits 1 when anything is left (CI gate).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = process.cwd()
const args = process.argv.slice(2)
const asJson = args.includes('--json')
const listFiles = args.includes('--files')
const check = args.includes('--check')
const prefixes = args.filter((a) => !a.startsWith('--'))
if (!prefixes.length) prefixes.push('src')

const SPACING = /^(padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(gap|row-gap|column-gap)$/
const RADIUS = /^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/
const SIZE = /^(min-|max-)?(width|height|inline-size|block-size)$|^(inset|top|right|bottom|left)$/

function walk(dir, out = []) {
  if (statSync(dir).isFile()) return dir.endsWith('.css') ? [...out, dir] : out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (name.endsWith('.css')) out.push(p)
  }
  return out
}

function offGrid(value) {
  const bad = []
  // strip calc/var fallbacks are still checked: any NNpx literal
  for (const m of value.matchAll(/(-?\d*\.?\d+)px/g)) {
    const n = Math.abs(parseFloat(m[1]))
    if (n === 0 || n === 1 || n === 2 || n >= 999) continue
    if (n % 4 !== 0) bad.push(m[0])
  }
  return bad
}

const files = prefixes.flatMap((p) => walk(join(root, p)))
const rows = []
for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  const rawLines = raw.split('\n')
  const text = raw.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(--[\w-]+|[a-z-]+)\s*:\s*([^;{}]+);?/)
    if (!m) return
    const [, prop, value] = m
    let kind = null
    if (SPACING.test(prop)) kind = 'spacing'
    else if (RADIUS.test(prop)) kind = 'radius'
    else if (SIZE.test(prop)) kind = 'size'
    else if (/^--.*(gap|pad|space|radius|gutter|inset)/i.test(prop)) kind = 'token'
    if (!kind) return
    if (/grid-exempt/.test(rawLines[i] ?? '')) return
    let bad = offGrid(value)
    if (kind === 'size') bad = bad.filter((b) => Math.abs(parseFloat(b)) >= 24)
    if (bad.length) rows.push({ file: relative(root, file).split(sep).join('/'), line: i + 1, kind, prop, value: value.trim(), bad })
  })
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2))
} else if (listFiles) {
  const byFile = new Map()
  for (const r of rows) byFile.set(r.file, (byFile.get(r.file) ?? 0) + 1)
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), f)
} else {
  const byKind = {}
  const byZone = {}
  for (const r of rows) {
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
    const parts = r.file.split('/')
    const zone = parts[1] === 'features' ? parts.slice(0, 3).join('/') : parts.slice(0, 3).join('/')
    byZone[zone] = (byZone[zone] ?? 0) + 1
  }
  console.log('total off-grid declarations:', rows.length)
  console.log('by kind:', byKind)
  for (const [z, n] of Object.entries(byZone).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(5), z)
}
if (check && rows.length) process.exit(1)
