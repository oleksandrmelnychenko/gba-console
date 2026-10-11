import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { matrixColumnKey, type MatrixResult } from '../data/originalVparivanie'
import { matrixScopeAccepted } from '../data/originalVparivanieScope'

/** The screen retains the admitted normal snapshot's physical rows and columns. */
export function OriginalVparivanieMatrix({ result }: { result: MatrixResult }) {
  const { t } = useI18n()
  if (!result.Available) return <Alert color="yellow">{t('Дані за обраний період ще синхронізуються. Спробуйте сформувати звіт пізніше.')}</Alert>
  if (!matrixScopeAccepted(result))
    return <Alert color="yellow">{t('Матриця проходить звірку з 1С. Звіт буде доступний після завершення перевірки.')}</Alert>
  return <AcceptedMatrix key={JSON.stringify([result.InputWitnessSha256, result.From, result.Through, result.GroupReference])} result={result} />
}
function AcceptedMatrix({ result }: { result: MatrixResult }) {
  const { t } = useI18n(), [page, setPage] = useState(0)
  const current = Math.min(page, Math.max(0, Math.ceil(result.Rows.length / 50) - 1)), first = current * 50
  return <Stack gap="xs"><Text fw={600}>{result.GroupCaption}</Text>
    <Group><Button size="xs" variant="light" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('Попередні рядки')}</Button>
      <Text size="xs">{result.Rows.length ? first + 1 : 0}–{Math.min(first + 50, result.Rows.length)} / {result.Rows.length}</Text>
      <Button size="xs" variant="light" disabled={first + 50 >= result.Rows.length} onClick={() => setPage(current + 1)}>{t('Наступні рядки')}</Button></Group>
    <Table.ScrollContainer minWidth={Math.max(640, 260 + result.Columns.length * 110)}>
      <Table captionSide="top"><Table.Caption>{t('Матриця товарів')} · {result.From} – {result.Through}</Table.Caption>
        <Table.Thead><Table.Tr><Table.Th scope="col">{t('Номенклатура')}</Table.Th>
          {result.Columns.map(column => <Table.Th key={matrixColumnKey(column)} scope="col">
            <div>{column.Caption}</div>{column.RegionCode === null ? <div>{t('Разом')}</div> : <><div>{column.RegionCode || '\u00a0'}</div><div>{column.MeasureCaption}</div></>}
          </Table.Th>)}
        </Table.Tr></Table.Thead>
        <Table.Tbody>{result.Rows.slice(first, first + 50).map(row => <Table.Tr key={row.ProductReference}>
          <Table.Th scope="row">{row.Caption}</Table.Th>{row.Values.map((value, column) => <Table.Td key={matrixColumnKey(result.Columns[column])} className="app-money">{value ?? ''}</Table.Td>)}
        </Table.Tr>)}</Table.Tbody>
      </Table>
    </Table.ScrollContainer>{!result.Rows.length ? <Text>{t('За обраний період рядків немає.')}</Text> : null}
  </Stack>
}
