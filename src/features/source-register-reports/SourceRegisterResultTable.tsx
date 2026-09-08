import { Alert, Group, Pagination, Stack, Text } from '@mantine/core'
import { useMemo, useState } from 'react'
import { formatExactRegisterNumber } from './exactNumber'
import { displayRegisterPeriod } from './period'
import { registerPaginationControlProps } from './pagination'
import { registerAtomIdentity, REGISTER_STAGE_LABELS, validateRegisterResult } from './validation'
import type { RegisterAtom, SourceRegisterDescriptorWire, SourceRegisterResultWire } from './types'
import './sourceRegisterReports.css'

export type SourceRegisterResultTableProps = {
  descriptor: SourceRegisterDescriptorWire
  registerLabel: string
  result: SourceRegisterResultWire
  /** Optional trusted display text, keyed by full registerAtomIdentity. Captions never replace typed keys. */
  referenceCaptions?: ReadonlyMap<string, string>
}
const GROUP_PAGE_SIZE = 50, MEASURE_PAGE_SIZE = 10

function AtomCell({ atom, captions }: { atom: RegisterAtom; captions?: ReadonlyMap<string, string> }) {
  switch (atom.kind) {
    case 'Undefined': return <span>Не визначено</span>
    case 'Null': return <span>Відсутнє значення (Null)</span>
    case 'Number': return <span className="source-register-exact">{formatExactRegisterNumber({ coefficient: atom.coefficient, scale: atom.scale })}</span>
    case 'Boolean': return <span>{atom.value ? 'Так' : 'Ні'}</span>
    case 'String': return <span className="source-register-text" title="Текстове значення">{atom.value === '' ? 'Порожній рядок' : atom.value}</span>
    case 'LocalDateTime': return <span>{displayRegisterPeriod(atom.value)}</span>
    case 'Reference': {
      const empty = /^0{32}$/.test(atom.rawReferenceHex)
      const caption = captions?.get(registerAtomIdentity(atom))
      return <div><span>{empty ? 'Порожнє посилання' : caption || `Посилання [${atom.rawReferenceHex.slice(-8)}]`}</span>
        <details><summary>Точне посилання</summary><dl className="source-register-audit">
          <dt>Тип джерела</dt><dd>{atom.sourceTypeUuid}</dd><dt>Значення</dt><dd>{atom.rawReferenceHex}</dd>
          {atom.rawPhysicalTypeTagHex !== undefined ? <><dt>Фізичний тип</dt><dd>{atom.rawPhysicalTypeTagHex}</dd><dt>Фізична таблиця</dt><dd>{atom.rawPhysicalTableTagHex}</dd></> : null}
        </dl></details>
      </div>
    }
  }
}

function RegisterResult({ descriptor, registerLabel, result, referenceCaptions }: SourceRegisterResultTableProps) {
  const [groupPage, setGroupPage] = useState(1), [measurePage, setMeasurePage] = useState(1)
  const metadata = result.publication.metadata
  const dimensions = new Map(descriptor.dimensions.map(field => [field.uuid, field]))
  const resources = new Map(descriptor.resources.map(field => [field.uuid, field]))
  const axisFields = [...result.query.rowFields, ...result.query.columnFields]
  const rowFieldCount = result.query.rowFields.length
  const groups = result.groups.slice((groupPage - 1) * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE)
  const firstMeasure = (measurePage - 1) * MEASURE_PAGE_SIZE
  const selections = result.query.selections.slice(firstMeasure, firstMeasure + MEASURE_PAGE_SIZE)
  const groupPages = Math.max(1, Math.ceil(result.groups.length / GROUP_PAGE_SIZE)), measurePages = Math.ceil(result.query.selections.length / MEASURE_PAGE_SIZE)
  return <section className="source-register-reports" aria-label="Результат регістрового звіту"><Stack gap="sm">
    <Text component="h2" fw={600}>{registerLabel}</Text>
    <Text size="sm">Джерело: {result.schema.world}. Ревізія знімка: <span>{metadata.revision}</span>.</Text>
    <Text size="sm">Період: {displayRegisterPeriod(result.query.from)} — {displayRegisterPeriod(result.query.toExclusive)} (кінцева межа не входить).</Text>
    <Text size="sm">Покриття знімка: {displayRegisterPeriod(metadata.coverageStart)} — {displayRegisterPeriod(metadata.coverageEndExclusive)} (кінцева межа не входить).</Text>
    <Alert color="blue">Показано точні значення, передані ядром звітів. Повну тотожність оригінальному звіту 1С не підтверджено.</Alert>
    <Group justify="space-between"><Text size="sm">Груп: {result.groups.length}. Показників: {result.query.selections.length}.</Text>
      <Text size="sm">Показники {firstMeasure + 1}–{firstMeasure + selections.length} із {result.query.selections.length}</Text>
    </Group>
    {measurePages > 1 ? <Pagination role="navigation" aria-label="Сторінки показників результату" getControlProps={registerPaginationControlProps} value={measurePage} onChange={setMeasurePage} total={measurePages} /> : null}
    {!result.groups.length ? <Text role="status">У результаті немає груп. Нижче наведено лише переданий загальний підсумок.</Text> : null}
    <div className="source-register-table-scroll" tabIndex={0} role="region" aria-label="Точні значення регістрового звіту">
      <table className="source-register-result-table"><caption className="source-register-table-caption">Групи та загальний підсумок. Суми показані без округлення.</caption>
        <thead><tr>{axisFields.length ? axisFields.map((id, index) => <th scope="col" key={id}>{dimensions.get(id)!.caption}<Text size="xs" c="dimmed">{index < rowFieldCount ? 'Рядки' : 'Колонки'}</Text><details><summary>Ідентифікатор виміру</summary><code>{id}</code></details></th>) : <th scope="col">Група</th>}
          {selections.map(item => <th scope="col" key={`${item.resourceUuid}:${item.stage}`}>{resources.get(item.resourceUuid)!.caption} — {REGISTER_STAGE_LABELS[item.stage]}<details><summary>Ідентифікатор ресурсу</summary><code>{item.resourceUuid}</code></details></th>)}
        </tr></thead>
        <tbody>{groups.map(group => <tr key={JSON.stringify([group.rowKey.map(registerAtomIdentity), group.columnKey.map(registerAtomIdentity)])}>
          {axisFields.length ? [...group.rowKey, ...group.columnKey].map((atom, index) => <td key={axisFields[index]}><AtomCell atom={atom} captions={referenceCaptions} /></td>) : <th scope="row">Без групування</th>}
          {selections.map((item, index) => <td className="source-register-exact" key={`${item.resourceUuid}:${item.stage}`}>{formatExactRegisterNumber(group.values[firstMeasure + index])}</td>)}
        </tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={Math.max(1, axisFields.length)}>Загальний підсумок</th>
          {selections.map((item, index) => <td className="source-register-exact" key={`${item.resourceUuid}:${item.stage}`}>{formatExactRegisterNumber(result.grandValues[firstMeasure + index])}</td>)}
        </tr></tfoot>
      </table>
    </div>
    {groupPages > 1 ? <Pagination role="navigation" aria-label="Сторінки груп результату" getControlProps={registerPaginationControlProps} value={groupPage} onChange={setGroupPage} total={groupPages} /> : null}
    <Text size="sm" c="dimmed">Таблиця містить лише отримані поєднання вимірів. Сторінки змінюють перегляд; загальний підсумок належить повному результату.</Text>
    <details><summary>Відомості про знімок для аудиту</summary><dl className="source-register-audit">
      <dt>Регістр</dt><dd>{result.schema.registerUuid}</dd><dt>Схема джерела</dt><dd>{result.schema.schemaHash}</dd>
      <dt>Знімок</dt><dd>{metadata.captureId}</dd><dt>Обсяг читання</dt><dd>{metadata.scopeHash}</dd>
      <dt>Контекст прав</dt><dd>{metadata.principalPolicyHash}</dd><dt>Свідчення джерела</dt><dd>{metadata.sourceReceiptHash}</dd>
      <dt>Вміст знімка</dt><dd>{result.publication.contentHash}</dd>
    </dl></details>
  </Stack></section>
}

/** Props are an already-decoded server result, never candidate capture facts or editable publication claims. */
export function SourceRegisterResultTable(props: SourceRegisterResultTableProps) {
  const error = useMemo(() => validateRegisterResult(props.result, props.descriptor), [props.result, props.descriptor])
  if (error) return <Alert color="red" role="alert">{error}</Alert>
  const key = `${props.result.publication.contentHash}:${props.result.publication.metadata.revision}:${JSON.stringify(props.result.query)}`
  return <RegisterResult key={key} {...props} />
}
