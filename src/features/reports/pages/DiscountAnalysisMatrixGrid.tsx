import { ReportRowPagination } from './ReportRowPagination'
import { ReportTableScrollArea } from './ReportTableScrollArea'
import { Group, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
type MatrixIndex<Cell> = { parties: { key: string; caption: string }[]; products: { key: string; caption: string }[]; cells: Map<string, Cell> }
export function DiscountAnalysisMatrixGrid<Cell>({ index, values, empty }: { index: MatrixIndex<Cell>; values: (cell: Cell | undefined) => string[]; empty: boolean }) {
  const { t } = useI18n()
  const [rowPage, setRowPage] = useState(0), [productPage, setProductPage] = useState(0)
  const row = Math.min(rowPage, Math.max(0, Math.ceil(index.parties.length / 50) - 1)) * 50
  const column = Math.min(productPage, Math.max(0, Math.ceil(index.products.length / 10) - 1)) * 10
  const parties = index.parties.slice(row, row + 50), products = index.products.slice(column, column + 10)
  return <Stack gap="xs"><ReportTableScrollArea minWidth={1000}><Table className="app-static-table" striped>
    <Table.Thead><Table.Tr><Table.Th>{t('Контрагент')}</Table.Th>{products.flatMap(p => [
      <Table.Th key={`${p.key}:price`}>{p.caption} · {t('Тип ціни')}</Table.Th>, <Table.Th key={`${p.key}:percentage`} className="app-table-cell-number">{p.caption} · {t('Відсоток знижки/націнки')}</Table.Th>,
    ])}</Table.Tr></Table.Thead><Table.Tbody>{parties.map(p => <Table.Tr key={p.key}><Table.Td>{p.caption}</Table.Td>{products.flatMap(product =>
      values(index.cells.get(JSON.stringify([p.key, product.key]))).map((value, i) => <Table.Td key={`${product.key}:${i}`} className={i === 1 ? 'app-table-cell-number' : undefined}>{value}</Table.Td>))}</Table.Tr>)}</Table.Tbody>
  </Table></ReportTableScrollArea><Group justify="space-between">
    <ReportRowPagination total={index.parties.length} offset={row} onChange={offset => setRowPage(offset / 50)} label="Контрагенти" rangeLabel="Контрагенти" previousLabel="Попередні контрагенти" nextLabel="Наступні контрагенти" />
    <ReportRowPagination total={index.products.length} offset={column} limit={10} onChange={offset => setProductPage(offset / 10)} label="Номенклатура" rangeLabel="Товари" previousLabel="Попередня номенклатура" nextLabel="Наступна номенклатура" />
  </Group>{empty ? <Text>{t('У повністю перевіреному зрізі рядків немає.')}</Text> : null}</Stack>
}
