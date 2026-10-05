import { Button, Group, Stack, Table, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { fenixDiscountIndex, fenixDiscountValues, type FenixDiscountResult } from '../data/originalFenixDiscountAnalysis'
export function OriginalFenixDiscountAnalysisGrid({ result }: { result: FenixDiscountResult }) {
  const { t } = useI18n(), index = useMemo(() => fenixDiscountIndex(result), [result])
  const [rowPage, setRowPage] = useState(0), [productPage, setProductPage] = useState(0)
  const row = Math.min(rowPage, Math.max(0, Math.ceil(index.parties.length / 50) - 1)) * 50
  const column = Math.min(productPage, Math.max(0, Math.ceil(index.products.length / 10) - 1)) * 10
  const parties = index.parties.slice(row, row + 50), products = index.products.slice(column, column + 10)
  return <Stack gap="xs"><Group>
    <Button variant="light" disabled={!row} onClick={() => setRowPage(Math.max(0, rowPage - 1))}>{t('Попередні контрагенти')}</Button>
    <Text>{index.parties.length ? row + 1 : 0}–{Math.min(row + 50, index.parties.length)} / {index.parties.length}</Text>
    <Button variant="light" disabled={row + 50 >= index.parties.length} onClick={() => setRowPage(rowPage + 1)}>{t('Наступні контрагенти')}</Button>
    <Button variant="light" disabled={!column} onClick={() => setProductPage(Math.max(0, productPage - 1))}>{t('Попередня номенклатура')}</Button>
    <Text>{index.products.length ? column + 1 : 0}–{Math.min(column + 10, index.products.length)} / {index.products.length}</Text>
    <Button variant="light" disabled={column + 10 >= index.products.length} onClick={() => setProductPage(productPage + 1)}>{t('Наступна номенклатура')}</Button>
  </Group><Table.ScrollContainer minWidth={1000}><Table striped>
    <Table.Thead><Table.Tr><Table.Th>{t('Контрагент')}</Table.Th>{products.flatMap(p => [
      <Table.Th key={`${p.key}:price`}>{p.caption} · {t('Тип ціни')}</Table.Th>, <Table.Th key={`${p.key}:percentage`}>{p.caption} · {t('Відсоток знижки/націнки')}</Table.Th>,
    ])}</Table.Tr></Table.Thead><Table.Tbody>{parties.map(p => <Table.Tr key={p.key}><Table.Td>{p.caption}</Table.Td>{products.flatMap(product =>
      fenixDiscountValues(index.cells.get(JSON.stringify([p.key, product.key]))).map((value, i) => <Table.Td key={`${product.key}:${i}`}>{value}</Table.Td>))}</Table.Tr>)}</Table.Tbody>
  </Table></Table.ScrollContainer>{!result.Cells.length ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
}
