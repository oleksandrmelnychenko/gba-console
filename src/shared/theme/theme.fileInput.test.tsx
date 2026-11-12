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
})
