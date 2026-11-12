import { FileInput, MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
// @ts-expect-error Keep the Node type scope out of the application compilation unit.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { theme } from './theme'

const srcRoot = 'src'

function listSourceFiles(directory: string): string[] {
  return (readdirSync(directory) as string[]).flatMap((name) => {
    const path = `${directory}/${name}`

    if (statSync(path).isDirectory()) return name === 'fixtures' ? [] : listSourceFiles(path)

    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : []
  })
}

function listFileInputs(source: string): string[] {
  const elements: string[] = []
  let from = 0

  for (;;) {
    const start = source.indexOf('<FileInput', from)

    if (start < 0) return elements

    let depth = 0
    let end = start

    for (; end < source.length; end += 1) {
      const char = source[end]

      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth === 0) break
    }

    elements.push(source.slice(start, end + 1))
    from = end + 1
  }
}

function describeFileInputPlaceholder(element: string): string | null {
  const attribute = /\splaceholder=/.exec(element)

  if (!attribute) return null

  const rest = element.slice(attribute.index + attribute[0].length)
  const literal = /^(?:"([^"]*)"|'([^']*)'|\{\s*(?:t|translate)\(\s*(?:"([^"]*)"|'([^']*)')\s*\)\s*\})/.exec(rest)

  if (!literal) return 'a computed placeholder'

  const text = literal[1] ?? literal[2] ?? literal[3] ?? literal[4]
  const isMultiple = /\smultiple(?=[\s/>])/.test(element)

  if (text === 'Оберіть файл') return null
  if (text === 'Оберіть файли' && isMultiple) return null

  return `the placeholder «${text}»`
}

describe('theme FileInput default', () => {
  it('renders the «Оберіть файл» placeholder on a file field that sets none', () => {
    render(
      <MantineProvider theme={theme}>
        <FileInput label="Документ" />
      </MantineProvider>,
    )

    expect(screen.getByText('Оберіть файл')).toBeTruthy()
  })

  it('keeps a more specific placeholder', () => {
    render(
      <MantineProvider theme={theme}>
        <FileInput label="Документи" multiple placeholder="Оберіть файли" />
      </MantineProvider>,
    )

    expect(screen.getByText('Оберіть файли')).toBeTruthy()
    expect(screen.queryByText('Оберіть файл')).toBeNull()
  })

  it('hides the placeholder once a file is chosen', () => {
    render(
      <MantineProvider theme={theme}>
        <FileInput label="Документ" value={new File(['x'], 'invoice.pdf')} onChange={() => undefined} />
      </MantineProvider>,
    )

    expect(screen.getByText('invoice.pdf')).toBeTruthy()
    expect(screen.queryByText('Оберіть файл')).toBeNull()
  })

  it('leaves no file field outside the themed provider or with a blanked placeholder', () => {
    const offenders = listSourceFiles(srcRoot).flatMap((path) => {
      const source = readFileSync(path, 'utf8') as string
      const file = path
      const problems: string[] = []

      for (const match of source.matchAll(/<MantineProvider\b([^>]*)>/g)) {
        if (!/theme=\{theme\}/.test(match[1])) problems.push(`${file}: MantineProvider without the app theme`)
      }

      for (const match of source.matchAll(/<FileInput\b[\s\S]*?\/>/g)) {
        if (/placeholder=(""|''|\{''\}|\{""\}|\{undefined\}|\{null\})/.test(match[0])) {
          problems.push(`${file}: FileInput with an empty placeholder`)
        }
      }

      return problems
    })

    expect(offenders).toEqual([])
  })

  it('reads «Оберіть файл» on every file field, plural only on a multi-file one', () => {
    const fields = listSourceFiles(srcRoot).flatMap((path) =>
      listFileInputs(readFileSync(path, 'utf8') as string).map((element) => ({ path, element })),
    )
    const offenders = fields.flatMap(({ path, element }) => {
      const problem = describeFileInputPlaceholder(element)

      return problem ? [`${path}: FileInput with ${problem}`] : []
    })

    expect(fields.length).toBeGreaterThan(40)
    expect(offenders).toEqual([])
  })

  it('rejects a different wording and a plural on a single-file field', () => {
    expect(describeFileInputPlaceholder("<FileInput label=\"x\" placeholder={t('Завантажити')} />")).toBe('the placeholder «Завантажити»')
    expect(describeFileInputPlaceholder('<FileInput placeholder="Обрати файл" />')).toBe('the placeholder «Обрати файл»')
    expect(describeFileInputPlaceholder("<FileInput placeholder={t('Оберіть файли')} />")).toBe('the placeholder «Оберіть файли»')
    expect(describeFileInputPlaceholder('<FileInput placeholder={label} />')).toBe('a computed placeholder')
    expect(describeFileInputPlaceholder("<FileInput multiple placeholder={t('Оберіть файли')} />")).toBeNull()
    expect(describeFileInputPlaceholder("<FileInput leftSection={<Upload size={16} />} placeholder={translate('Оберіть файл')} />")).toBeNull()
    expect(describeFileInputPlaceholder('<FileInput label="x" />')).toBeNull()
  })
})
