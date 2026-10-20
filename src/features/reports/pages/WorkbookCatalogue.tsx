import { Alert, Button, Group, Select, Text, TextInput } from '@mantine/core'
import { RotateCcw, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn } from '../../../shared/ui/data-table/types'
import { availableBug1274WorkbookLaunches, BUG_1274_WORKBOOK_REPORT_IDS, type WorkbookLaunch } from '../data/bug1274WorkbookLaunch'
import { bug1274ReportTitle } from '../data/bug1274WorkbookGuide'
import { filterConsoleMigrationCatalogue, inspectCatalogueMigration } from '../data/reportMigration'
import { workbookDeskEntry } from '../data/workbookDesk'
import type { ReportCatalogue, ReportCatalogueEntry, ReportDataset } from '../types'

type Props = {
  catalogue: ReportCatalogue
  inspection: ReturnType<typeof inspectCatalogueMigration>
  datasets: ReportDataset[] | null
  canGenerate: boolean
  disabled: boolean
  onOpenWorkbook?: (launch: WorkbookLaunch) => boolean
  renderDetails: (report: ReportCatalogueEntry) => ReactNode
}

export function WorkbookCatalogue({ catalogue, inspection, datasets, canGenerate, disabled, onOpenWorkbook, renderDetails }: Props) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [world, setWorld] = useState<string | null>(null)
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null)
  const launches = useMemo(() => availableBug1274WorkbookLaunches(datasets ?? []), [datasets])
  const reports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uk')
    return filterConsoleMigrationCatalogue(catalogue, inspection, { search: '', world, kind: null, status: null, dependency: null })
      .map(item => item.report)
      .filter(report => [report.Name, report.Title, t(bug1274ReportTitle(report.Id) ?? report.Title)].join(' ').toLocaleLowerCase('uk').includes(query))
  }, [catalogue, inspection, search, world, t])
  const worlds = useMemo(() => [...new Set(catalogue.Reports.flatMap(report => report.Sources.map(source => source.World)))], [catalogue])
  const columns = useMemo<DataTableColumn<ReportCatalogueEntry>[]>(() => [
    { id: 'report', header: t('Звіт'), accessor: report => bug1274ReportTitle(report.Id) ?? report.Title,
      width: 400, minWidth: 220, fill: true, numeric: false,
      cell: report => <span className="workbook-catalogue__name" title={report.Title}>{t(bug1274ReportTitle(report.Id) ?? report.Title)}</span> },
    { id: 'worlds', header: t('Бази'), accessor: report => report.Sources.map(source => source.World.toUpperCase()).join(' · '),
      width: 130, minWidth: 110, numeric: false },
    { id: 'forms', header: t('Відкрити форму'), width: 400, minWidth: 300, enableSorting: false,
      cell: report => {
        const forms = launches.filter(launch => BUG_1274_WORKBOOK_REPORT_IDS[launch.fileName] === report.Id)
        return forms.length ? <Group gap={6} wrap="nowrap">
          {forms.map(launch => <Button key={launch.fileName} type="button" size="compact-sm" variant="default"
            aria-label={launch.fileName} title={launch.fileName} disabled={disabled || !canGenerate || !onOpenWorkbook}
            onClick={event => { event.stopPropagation(); if (!disabled && canGenerate) onOpenWorkbook?.(launch) }}>
            {t(workbookDeskEntry(launch.fileName)?.name ?? launch.label)}
          </Button>)}
        </Group> : <Text size="sm" c="gray.7">{t(canGenerate ? 'Форми недоступні' : 'Немає права формування')}</Text>
      } },
  ], [t, launches, canGenerate, disabled, onOpenWorkbook])
  return <div className="report-catalogue workbook-catalogue">
    {!inspection.valid ? <Alert color="yellow">{t('Стан перенесення не підтверджений сервером. Перевірте відомості про звіт.')}</Alert> : null}
    <div className="workbook-catalogue__list">
      <div className="workbook-catalogue__filter-scroll">
        <div className="app-filter-bar workbook-catalogue__filters">
          <TextInput label={t('Пошук звіту')} placeholder={t('Назва звіту')} leftSection={<Search size={16} />}
            value={search} onChange={event => setSearch(event.currentTarget.value)} />
          <Select classNames={{ dropdown: 'reports-toolbar-dropdown' }} label={t('База')} placeholder={t('Усі бази')} clearable value={world}
            data={worlds.map(value => ({ value, label: value === 'fenix' ? 'Fenix' : value === 'amg' ? 'AMG' : value }))}
            onChange={setWorld} />
          <div className="app-filter-actions">
            <Button type="button" aria-label={t('Скинути фільтри')} title={t('Скинути фільтри')}
              onClick={() => { setSearch(''); setWorld(null) }} className="reports-toolbar-action" variant="default" leftSection={<RotateCcw size={16} />}>{t('Скинути')}</Button>
            <span className="workbook-catalogue__count">{t('Звітів: {count}', { count: reports.length })}</span>
          </div>
          <div ref={setToolbar} className="app-filter-table-toolbar-slot" />
        </div>
      </div>
      <DataTable tableId="report-workbook-catalogue" layoutVersion={1} columns={columns} data={reports}
        getRowId={report => report.Id} defaultLayout={{ density: 'normal' }} minWidth={850} maxHeight={420}
        showLayoutControls toolbarPortalTarget={toolbar} emptyText={t('Звітів за цими умовами не знайдено')}
        expandColumnLabels={{ expandRow: t('Відомості про звіт'), collapseRow: t('Згорнути відомості') }}
        renderExpandedRow={report => <div className="workbook-catalogue__details">
          <Text size="sm" c="gray.8">{t('Назва в конфігурації 1С: {name}', { name: report.Title })}</Text>
          {renderDetails(report)}
        </div>} />
    </div>
  </div>
}
