import { Button, Checkbox, Group, Stack, Text } from '@mantine/core'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TableChip } from '../../../shared/ui/TableChip'
import type { ReportDataset, ReportGroupingItem } from '../types'
import { sourceOrganizations as parseSourceOrganizations, sourceBuyerSubtree as parseSourceBuyerSubtree,
  FENIX_BUYERS_ROOT_ID, goodsWithoutServices, isProductServiceFilterCapability, productServiceFilter as parseProductServiceFilter,
  productServiceFromClassification, unmappedProductClassificationError } from '../data/nativeExactFilters'
import { DAY_ORGANIZATION_OUT_OF_SCOPE_ORGANIZATION_IDS, DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS } from '../data/dayOrganizationGrossProfit'
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

export function DayProfitControls({ part, dataset, disabled, hideRegister, profitReadMode, dayOrganizationBasis,
  productClassification, productServiceFilter, sourceOrganizations, sourceBuyerSubtree, setProfitReadMode, setDayOrganizationBasis,
  setProductClassification, setProductServiceFilter, setSourceOrganizations, setSourceBuyerSubtree }: {
  part?: ProfitControlsPart
  dataset?: ReportDataset
  disabled: boolean
  hideRegister: boolean
  profitReadMode: unknown
  dayOrganizationBasis: unknown
  productClassification?: unknown
  productServiceFilter: unknown
  sourceOrganizations: unknown
  sourceBuyerSubtree: unknown
  setProfitReadMode: Setter
  setDayOrganizationBasis: Setter
  setProductClassification?: Setter
  setProductServiceFilter: Setter
  setSourceOrganizations: Setter
  setSourceBuyerSubtree: Setter
}) {
  const { t } = useI18n()
  const shows = (name: ProfitControlsPart) => part === undefined || part === name
  const goods = parseProductServiceFilter(productServiceFilter)?.IsService === false
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
    {shows('filters') && isProductServiceFilterCapability(dataset?.productServiceFilter) && productClassification != null ? (() => {
      const replacement = productServiceFromClassification(productClassification)
      return <Stack gap={6}>
        <Text size="xs" c="red">{replacement
          ? t('Шаблон містить відбір виду товару 1С. Замініть його на рівнозначний відбір GBA і збережіть шаблон повторно.')
          : unmappedProductClassificationError(productClassification)}</Text>
        <Group gap="xs">
          {replacement ? <Button size="xs" variant="light" disabled={disabled} onClick={() => {
            setProductServiceFilter(replacement)
            setProductClassification?.(undefined)
          }}>{t('Замінити на «Товар без послуг»')}</Button>
            : <Button size="xs" variant="light" color="red" disabled={disabled} onClick={() => setProductClassification?.(undefined)}>
              {t('Вилучити відбір виду товару 1С')}</Button>}
        </Group>
      </Stack>
    })() : shows('filters') && isProductServiceFilterCapability(dataset?.productServiceFilter) ? <>
      <FilterOption selected={goods}>
      <Checkbox label={t('Товар без послуг')} checked={goods} disabled={disabled}
        onChange={event => setProductServiceFilter(event.currentTarget.checked ? goodsWithoutServices() : undefined)} />
      </FilterOption>
      {productServiceFilter != null && !goods
        ? <Text size="xs" c="orange">{t('Шаблон містить відбір «Послуги». Увімкнення перемикача замінить його на «Товар без послуг».')}</Text> : null}
    </> : null}
    {shows('organizations') ? <>
      <Checkbox mt="sm" label={t('Організації книги ВП')}
        checked={usesSavedFenixOrganizations(sourceOrganizations)}
        disabled={disabled}
        onChange={event => setSourceOrganizations(event.currentTarget.checked
          ? { Version: 1, SourceWorld: 'fenix', OrganizationIds: [...DAY_ORGANIZATION_SAVED_ORGANIZATION_IDS] }
          : undefined)} />
      <Group gap={6} mt={8} aria-label={t('Організації книги ВП')}>
        {['ТОВ «АМГ «КОНКОРД»', 'Фенікс', 'ФОП Самолюк А.Д.', 'ФОП Самолюк Ю.М.'].map(name =>
          <TableChip key={name} value={name} tone="product" />)}
      </Group>
      {sourceOrganizations != null && !usesSavedFenixOrganizations(sourceOrganizations)
        ? <Text size="xs" c="orange">{t('Шаблон містить інший перелік організацій. Увімкнення перемикача замінить його на організації книги ВП.')}</Text> : null}
    </> : null}
    {shows('filters') ? <>
      <FilterOption selected={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}>
      <Checkbox label={t('Група «Покупці»')}
        checked={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}
        disabled={disabled}
        onChange={event => setSourceBuyerSubtree(event.currentTarget.checked
          ? { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID }
          : undefined)} />
      </FilterOption>
      {sourceBuyerSubtree != null && !parseSourceBuyerSubtree(sourceBuyerSubtree)
        ? <Text size="xs" c="orange">{t('Шаблон містить інше піддерево покупців; цей набір приймає тільки групу «Покупці».')}</Text> : null}
    </> : null}
  </>
}

export function SupplierProfitControls({ part, dataset, disabled, hideRegister, profitReadMode, supplierBasis,
  sourceBuyerSubtree, groupingOptions, setProfitReadMode, setSupplierBasis, setSourceBuyerSubtree, setRowGroups }: {
  part?: ProfitControlsPart
  dataset?: ReportDataset
  disabled: boolean
  hideRegister: boolean
  profitReadMode: unknown
  supplierBasis: unknown
  sourceBuyerSubtree: unknown
  groupingOptions: ReportGroupingItem[]
  setProfitReadMode: Setter
  setSupplierBasis: Setter
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
    </> : null}
    {shows('filters') && dataset?.sourceBuyerSubtree != null ? <>
      <FilterOption selected={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}>
      <Checkbox label={t('Група «Покупці»')}
        checked={parseSourceBuyerSubtree(sourceBuyerSubtree) != null}
        disabled={disabled}
        onChange={event => {
          setSourceBuyerSubtree(event.currentTarget.checked
            ? { Version: 1, SourceWorld: 'fenix', BuyerRootId: FENIX_BUYERS_ROOT_ID }
            : undefined)
        }} />
      </FilterOption>
      {sourceBuyerSubtree != null && !parseSourceBuyerSubtree(sourceBuyerSubtree)
        ? <Text size="xs" c="orange">{t('Шаблон містить інше піддерево покупців; цей набір приймає тільки групу «Покупці».')}</Text> : null}
    </> : null}
  </>
}
