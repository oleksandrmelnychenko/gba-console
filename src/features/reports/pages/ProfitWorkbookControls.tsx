import { Checkbox, Group, Select, Text } from '@mantine/core'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'
import type { ReportDataset, ReportGroupingItem } from '../types'
import { productClassification as parseProductClassification, sourceOrganizations as parseSourceOrganizations,
  sourceBuyerSubtree as parseSourceBuyerSubtree, FENIX_BUYERS_ROOT_ID } from '../data/nativeExactFilters'
import { DAY_ORGANIZATION_GOODS_KIND_ID, DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS,
  DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from '../data/dayOrganizationGrossProfit'
import { rowGroupsForSupplierBasis } from '../data/supplierBasis'
import { ProfitReadModeSelect } from './ProfitReadModeSelect'
import { DayOrganizationBasisSelect } from './DayOrganizationBasisSelect'
import { SupplierBasisSelect } from './SupplierBasisSelect'

export type ProfitControlsPart = 'source' | 'organizations' | 'filters'

type Setter = Dispatch<SetStateAction<unknown>>

function FilterOption({ selected, children }: { selected: boolean; children: ReactNode }) {
  return <div className="workbook-filter-option app-selection-surface" data-selected={selected}>
    {children}
  </div>
}

function usesSavedFenixOrganizations(value: unknown): boolean {
  const ids = parseSourceOrganizations(value)?.OrganizationIds.map(id => id.toUpperCase())
    .filter(id => !(DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS as readonly string[]).includes(id))
  if (ids?.length !== DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.length) return false
  return DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS.every(id => ids.includes(id))
}

function isSavedGoods(value: unknown): boolean {
  const parsed = parseProductClassification(value)
  return parsed?.ProductKindId.toUpperCase() === DAY_ORGANIZATION_GOODS_KIND_ID && parsed.IsService === false
}

export function DayProfitControls({ part, dataset, disabled, hideRegister, profitReadMode, dayOrganizationBasis,
  productClassification, sourceOrganizations, sourceBuyerSubtree, setProfitReadMode, setDayOrganizationBasis,
  setProductClassification, setSourceOrganizations, setSourceBuyerSubtree }: {
  part?: ProfitControlsPart
  dataset?: ReportDataset
  disabled: boolean
  hideRegister: boolean
  profitReadMode: unknown
  dayOrganizationBasis: unknown
  productClassification: unknown
  sourceOrganizations: unknown
  sourceBuyerSubtree: unknown
  setProfitReadMode: Setter
  setDayOrganizationBasis: Setter
  setProductClassification: Setter
  setSourceOrganizations: Setter
  setSourceBuyerSubtree: Setter
}) {
  const { t } = useI18n()
  const shows = (name: ProfitControlsPart) => part === undefined || part === name
  return <>
    {shows('source') ? <>
      <ProfitReadModeSelect capability={dataset?.profitReadMode} value={profitReadMode}
        disabled={disabled} hideRegister={hideRegister} onChange={mode => {
          setProfitReadMode(mode)
          if (mode != null) setDayOrganizationBasis(0)
        }} />
      <DayOrganizationBasisSelect capability={dataset?.dayOrganizationBasis} value={dayOrganizationBasis}
        disabled={disabled || profitReadMode != null} hideLocked={hideRegister && profitReadMode != null} onChange={setDayOrganizationBasis} />
    </> : null}
    {shows('filters') ? <>
      <FilterOption selected={isSavedGoods(productClassification)}>
      <Checkbox label={t('Товар без послуг (Fenix)')}
        checked={isSavedGoods(productClassification)}
        disabled={disabled}
        onChange={event => setProductClassification(event.currentTarget.checked
          ? { Version: 1, SourceWorld: 0, ProductKindId: DAY_ORGANIZATION_GOODS_KIND_ID, IsService: false }
          : undefined)} />
      </FilterOption>
      {productClassification != null && !isSavedGoods(productClassification)
        ? <Text size="xs" c="orange">{t('Шаблон містить інший вид товару Fenix. Увімкнення перемикача замінить цей відбір на «Товар».')}</Text> : null}
    </> : null}
    {shows('organizations') ? <>
      <Checkbox mt="sm" label={t('Організації зі збереженого налаштування 1С')}
        checked={usesSavedFenixOrganizations(sourceOrganizations)}
        disabled={disabled}
        onChange={event => setSourceOrganizations(event.currentTarget.checked
          ? { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] }
          : undefined)} />
      <Group gap={6} mt={8} aria-label={t('Організації зі збереженого налаштування 1С')}>
        {['ТОВ «АМГ «КОНКОРД»', 'Фенікс', 'ФОП Самолюк А.Д.', 'ФОП Самолюк Ю.М.'].map(name =>
          <TableChip key={name} value={name} tone="product" />)}
      </Group>
      {sourceOrganizations != null && !usesSavedFenixOrganizations(sourceOrganizations)
        ? <Text size="xs" c="orange">{t('Шаблон містить інші організації Fenix. Увімкнення перемикача замінить цей відбір на організації налаштування 1С.')}</Text> : null}
    </> : null}
    {shows('filters') ? <>
      <FilterOption selected={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}>
      <Checkbox label={t('Група «Покупці» Fenix')}
        checked={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}
        disabled={disabled}
        onChange={event => setSourceBuyerSubtree(event.currentTarget.checked
          ? { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID }
          : undefined)} />
      </FilterOption>
      {sourceBuyerSubtree != null && !parseSourceBuyerSubtree(sourceBuyerSubtree)
        ? <Text size="xs" c="orange">{t('Шаблон містить інше піддерево Fenix; цей набір приймає тільки групу «Покупці».')}</Text> : null}
    </> : null}
  </>
}

export function SupplierProfitControls({ part, dataset, disabled, hideRegister, profitReadMode, supplierBasis,
  supplierSourceWorld, sourceBuyerSubtree, groupingOptions, setProfitReadMode, setSupplierBasis, setSupplierSourceWorld,
  setSourceBuyerSubtree, setRowGroups }: {
  part?: ProfitControlsPart
  dataset?: ReportDataset
  disabled: boolean
  hideRegister: boolean
  profitReadMode: unknown
  supplierBasis: unknown
  supplierSourceWorld: unknown
  sourceBuyerSubtree: unknown
  groupingOptions: ReportGroupingItem[]
  setProfitReadMode: Setter
  setSupplierBasis: Setter
  setSupplierSourceWorld: Setter
  setSourceBuyerSubtree: Setter
  setRowGroups: Dispatch<SetStateAction<ReportGroupingItem[]>>
}) {
  const { t } = useI18n()
  const shows = (name: ProfitControlsPart) => part === undefined || part === name
  return <>
    {shows('source') ? <>
      <ProfitReadModeSelect capability={dataset?.profitReadMode} value={profitReadMode}
        disabled={disabled} hideRegister={hideRegister} onChange={mode => {
          setProfitReadMode(mode)
          if (mode === 0) setSupplierSourceWorld(undefined)
          if (mode === 1) setSupplierSourceWorld(0)
          if (mode != null) {
            setSupplierBasis(0)
            setRowGroups(rows => rowGroupsForSupplierBasis(0, rows, groupingOptions))
          }
        }} />
      <SupplierBasisSelect capability={dataset?.supplierBasis} value={supplierBasis}
        disabled={disabled || profitReadMode != null} hideLocked={hideRegister && profitReadMode != null} onChange={basis => {
          setSupplierBasis(basis)
          setRowGroups(rows => rowGroupsForSupplierBasis(basis, rows, groupingOptions))
        }} />
      <Select label={t('База продажів для прибутку за постачальниками')}
        data={[{ value: '0', label: 'Fenix' }, { value: '1', label: 'AMG' },
          { value: 'all', label: t(profitReadMode === 0 ? 'Усі документи, включно з GBA' : 'Обидві бази') }]}
        value={supplierSourceWorld === 0 ? '0' : supplierSourceWorld === 1 ? '1' : 'all'}
        disabled={disabled}
        onChange={value => {
          const world = value === '0' ? 0 : value === '1' ? 1 : undefined
          setSupplierSourceWorld(world)
          if (world !== 0) setSourceBuyerSubtree(undefined)
        }} />
    </> : null}
    {shows('filters') && dataset?.sourceBuyerSubtree != null ? <>
      <FilterOption selected={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}>
      <Checkbox label={t('Група «Покупці» Fenix')}
        checked={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}
        disabled={disabled}
        onChange={event => {
          if (event.currentTarget.checked) setSupplierSourceWorld(0)
          setSourceBuyerSubtree(event.currentTarget.checked
            ? { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID }
            : undefined)
        }} />
      </FilterOption>
      {sourceBuyerSubtree != null && !parseSourceBuyerSubtree(sourceBuyerSubtree)
        ? <Text size="xs" c="orange">{t('Шаблон містить інше піддерево Fenix; цей набір приймає тільки групу «Покупці».')}</Text> : null}
    </> : null}
    {shows('source') && supplierSourceWorld !== undefined && supplierSourceWorld !== 0 && supplierSourceWorld !== 1
      ? <Text size="xs" c="orange">{t('Шаблон містить невідому базу джерела; виберіть Fenix або AMG.')}</Text> : null}
  </>
}
