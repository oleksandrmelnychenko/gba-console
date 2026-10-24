import { AppModalFooter } from '../../../shared/ui/AppModal'
import { ActionIcon, Alert, Badge, Button, Group, Menu, Skeleton, Stack, Text, TextInput } from '@mantine/core'
import { ArrowLeft, ArrowRight, CalendarDays, Check, CircleAlert, Copy, Eye, LayoutTemplate, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action/TableRowAction'
import { isCurrentReportSource } from '../data/nativeReportProfiles'
import type { TemplateMutationResult, useServerReportTemplates } from '../hooks/useServerReportTemplates'
import type { ReportDataset, ReportTemplate } from '../types'
import { formatDate } from '../utils'
import { SavedNativeReportPanel } from './SavedNativeReportPanel'
import { ReportTemplateOrderingControls } from './ReportTemplateOrderingControls'

type Action = { kind: 'rename' | 'copy' | 'delete'; template: ReportTemplate; name: string }
const emptyDatasets: readonly ReportDataset[] = []
type Props = {
  initiallyCreating?: boolean
  storage: Pick<ReturnType<typeof useServerReportTemplates>, 'templates' | 'busy' | 'ready' | 'notice' | 'browserTemplates'
    | 'reload' | 'save' | 'update' | 'rename' | 'copy' | 'remove' | 'importBrowserTemplate'>
    & Partial<Pick<ReturnType<typeof useServerReportTemplates>, 'noticeKind'>>
  ordering?: ReturnType<typeof useServerReportTemplates>['ordering']
  configurationReady: boolean
  configurationName?: string
  disabled?: boolean
  datasets?: readonly ReportDataset[]
  dataSources?: ReadonlySet<number>
  callerKey?: string | null
  requireReadMode?: boolean
  notice: string | null
  templateName: string
  activeTemplate: ReportTemplate | null
  onNameChange: (value: string) => void
  onApply: (template: ReportTemplate) => void
  onSave: () => Promise<TemplateMutationResult>
  onUpdate: () => Promise<TemplateMutationResult>
  onRenamed: (template: ReportTemplate, source: ReportTemplate) => void
  onDeleted: (id: string) => void
  onClearNotice: () => void
  onRefresh: () => void
}

export function ReportTemplatesPanel({ initiallyCreating = false, storage, ordering, configurationReady, configurationName, disabled = false, datasets = emptyDatasets, dataSources, callerKey = null, requireReadMode = false, notice, templateName,
  activeTemplate, onNameChange, onApply, onSave, onUpdate, onRenamed, onDeleted, onClearNotice, onRefresh }: Props) {
  const { t } = useI18n()
  const [action, setAction] = useState<Action | null>(null)
  const [creating, setCreating] = useState(initiallyCreating)
  const [search, setSearch] = useState('')
  const [savedVariant, setSavedVariant] = useState<ReportTemplate | null>(null)
  const actionTitleId = useId()
  const blocked = disabled || storage.busy || !storage.ready
  const current = activeTemplate ? storage.templates.find(item => item.Id === activeTemplate.Id) : undefined
  const stale = Boolean(activeTemplate && (!current || current.Revision !== activeTemplate.Revision))
  const listed = (template: ReportTemplate) => !dataSources || dataSources.has(template.Data.dataSource ?? 0)
  const templates = storage.templates.filter(listed)
  const browserTemplates = storage.browserTemplates.filter(listed)
  const success = notice === storage.notice && storage.noticeKind === 'success'
  const toList = () => { setCreating(false); setAction(null); setSavedVariant(null) }

  async function save() {
    if (blocked || !configurationReady || !templateName.trim()) return
    const result = await onSave()
    if (result.ok) { setCreating(false); setSearch('') }
  }

  return <div className="reports-stocks-template-card" aria-busy={storage.busy}>
    {notice ? <Alert color={success ? 'green' : 'red'} variant="outline" role={success ? 'status' : 'alert'}
      icon={success ? <Check size={18} /> : <CircleAlert size={18} />}>{notice}</Alert> : null}
    {creating ? <section className="reports-stocks-template-editor" aria-label={t('Новий шаблон')}>
      <TemplateBack disabled={storage.busy} onClick={toList} />
      <Text className="app-section-title">{t('Зберегти поточні налаштування')}</Text>
      {configurationName ? <Text size="sm" c="gray.8">{configurationName}</Text> : null}
      <TextInput className="reports-stocks-template-name" label={t('Назва шаблону')} value={templateName}
        autoFocus placeholder={t('Наприклад, продажі за регіонами')} disabled={blocked}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save() } }}
        onChange={event => onNameChange(event.currentTarget.value)} />
      <AppModalFooter>
        <Button className="reports-stocks-template-secondary" variant="default" disabled={storage.busy} onClick={toList}>{t('Скасувати')}</Button>
        <Button color={CREATE_ACTION_COLOR} disabled={blocked || !configurationReady || !templateName.trim()} loading={storage.busy}
          leftSection={<Save size={16} />} type="button" onClick={() => void save()}>{t('Зберегти')}</Button>
      </AppModalFooter>
    </section> : action ? <TemplateActionController action={action} titleId={actionTitleId} blocked={blocked} storage={storage}
      onNameChange={name => setAction({ ...action, name })} onRenamed={onRenamed} onDeleted={onDeleted}
      onComplete={toList} /> : savedVariant ? <SavedNativeReportPanel template={savedVariant} datasets={datasets} callerKey={callerKey}
      requireReadMode={requireReadMode} enabled={!blocked} current={storage.templates.some(item => item.Id === savedVariant.Id
        && item.Revision === savedVariant.Revision && JSON.stringify(item.Data) === JSON.stringify(savedVariant.Data))}
      onClose={toList} /> : <>
      <div className="app-filter-bar reports-stocks-template-toolbar">
        <TextInput aria-label={t('Пошук шаблонів')} placeholder={t('Знайти шаблон')} value={search} leftSection={<Search size={16} />}
          rightSection={search ? <ActionIcon variant="subtle" color="gray" aria-label={t('Очистити пошук')} onClick={() => setSearch('')}><X size={14} /></ActionIcon> : null}
          onChange={event => setSearch(event.currentTarget.value)} />
        <Button className="reports-stocks-template-secondary reports-toolbar-action" aria-label={t('Оновити список')} title={t('Оновити список')}
          type="button" disabled={disabled || storage.busy} onClick={onRefresh} variant="default" leftSection={<RefreshCw size={16} />}>{t('Оновити')}</Button>
        <Button color={CREATE_ACTION_COLOR} leftSection={<Plus size={16} />} disabled={blocked || !configurationReady}
          onClick={() => { onClearNotice(); setCreating(true) }}>{t('Новий шаблон')}</Button>
      </div>
      {activeTemplate ? <div className="reports-stocks-template-active">
        <div><Text size="xs" c="gray.7">{t('Відкритий шаблон')}</Text><Text fw={600} size="sm">{activeTemplate.Name}</Text></div>
        <Button type="button" className="reports-stocks-template-secondary" variant="default" leftSection={<Save size={16} />}
          disabled={blocked || !configurationReady || stale} onClick={() => void onUpdate()}>{t('Оновити шаблон')}</Button>
        {stale && storage.ready ? <Text className="reports-stocks-template-active__notice" size="sm" c="red.8">
          {t('Шаблон змінився або видалений. Відкрийте його знову перед збереженням змін.')}</Text> : null}
      </div> : null}
      {ordering && !dataSources ? <ReportTemplateOrderingControls key={callerKey} ordering={ordering} blocked={blocked} busy={storage.busy} /> : null}
      <SavedTemplatesSection templates={templates} datasets={datasets} activeId={activeTemplate?.Id} search={search}
        loading={!storage.ready && !notice} failed={!storage.ready && Boolean(notice)} blocked={blocked} onApply={onApply}
        onRunSaved={template => { onClearNotice(); setSavedVariant(structuredClone(template)) }}
        onAction={(template, kind) => {
          onClearNotice()
          setAction({ kind, template, name: kind === 'copy' ? `${template.Name} — ${t('копія')}` : template.Name })
        }} />
      {browserTemplates.length ? <details className="reports-stocks-template-import">
        <summary>{t('Шаблони цього браузера')} <span>{browserTemplates.length}</span></summary>
        <Stack gap="xs" mt="sm">
          {browserTemplates.map(template => <Group key={JSON.stringify({ Name: template.Name, Data: template.Data })} justify="space-between">
            <Text size="sm">{template.Name}</Text><Button type="button" size="xs" variant="default" disabled={blocked}
              onClick={() => { onClearNotice(); void storage.importBrowserTemplate(template) }}>{t('Імпортувати')}</Button>
          </Group>)}
        </Stack>
      </details> : null}
    </>}
  </div>
}

function TemplateBack({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useI18n()
  return <Button type="button" variant="default" className="reports-stocks-template-secondary reports-stocks-template-back"
    leftSection={<ArrowLeft size={16} />} disabled={disabled} onClick={onClick}>{t('До шаблонів')}</Button>
}

function TemplateActionConfirmation({ action, titleId, blocked, busy, onNameChange, onConfirm, onCancel }: {
  action: Action; titleId: string; blocked: boolean; busy: boolean
  onNameChange: (name: string) => void; onConfirm: () => void; onCancel: () => void
}) {
  const { t } = useI18n()
  const actionTitle = action.kind === 'rename' ? t('Перейменувати шаблон')
    : action.kind === 'copy' ? t('Створити копію шаблону') : t('Видалити шаблон')
  return <Stack className="reports-stocks-template-editor" role="region" aria-labelledby={titleId} gap="md">
    <TemplateBack disabled={busy} onClick={onCancel} />
    <Text id={titleId} className="app-section-title">{actionTitle}</Text>
    <Text fw={600}>{action.template.Name}</Text>
    {action.kind === 'delete' ? <Text size="sm" c="gray.8">{t('Видалити цей шаблон? Поточний звіт залишиться без змін.')}</Text>
      : <TextInput label={action.kind === 'copy' ? t('Назва копії') : t('Нова назва')}
        autoFocus value={action.name} disabled={blocked} onChange={event => onNameChange(event.currentTarget.value)} />}
    <AppModalFooter>
      <Button type="button" className="reports-stocks-template-secondary" variant="default" disabled={busy} onClick={onCancel}>{t('Скасувати')}</Button>
      <Button type="button" color={action.kind === 'delete' ? 'red' : CREATE_ACTION_COLOR} loading={busy}
        disabled={blocked || (action.kind !== 'delete' && !action.name.trim())} onClick={onConfirm}>
        {action.kind === 'delete' ? t('Підтвердити видалення') : t('Підтвердити')}
      </Button>
    </AppModalFooter>
  </Stack>
}

function SavedTemplateRow({ template, dataset, active, blocked, onApply, onRunSaved, onAction }: {
  template: ReportTemplate; dataset?: ReportDataset; active: boolean; blocked: boolean
  onApply: () => void; onRunSaved: () => void; onAction: (kind: Action['kind']) => void
}) {
  const { t } = useI18n()
  const period = isCurrentReportSource(template.Data.dataSource) && !template.Data.from && !template.Data.to
    ? t('Поточний стан') : template.Data.from || template.Data.to
      ? [template.Data.from, template.Data.to].filter(Boolean).map(formatDate).filter((value, index, values) => values.indexOf(value) === index).join(' – ') : null
  return <div className="reports-stocks-template-item" role="group" aria-label={template.Name}>
    <span className="reports-stocks-template-item__icon"><LayoutTemplate size={20} aria-hidden="true" /></span>
    <div className="reports-stocks-template-item__content">
      <Group gap={8}><Text className="reports-stocks-template-item__name">{template.Name}</Text>
        {active ? <Badge variant="outline" color="gray">{t('Відкрито')}</Badge> : null}</Group>
      {dataset ? <Text size="xs" c="gray.7">{t(dataset.Name)}</Text> : null}
      {period ? <span className="reports-stocks-template-period"><CalendarDays size={13} aria-hidden="true" />{period}</span> : null}
    </div>
    <Group className="reports-stocks-template-item__actions" gap={8} wrap="nowrap">
      <Button type="button" size="xs" color={CREATE_ACTION_COLOR} rightSection={<ArrowRight size={15} />}
        aria-label={t('Відкрити для редагування: {name}', { name: template.Name })} disabled={blocked} onClick={onApply}>{t('Відкрити')}</Button>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target><TableRowAction action="more" label={t('Дії шаблону: {name}', { name: template.Name })} disabled={blocked} /></Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<Eye size={16} />} disabled={blocked || !template.Id || !template.Revision} onClick={onRunSaved}>{t('Збережений варіант')}</Menu.Item>
          <Menu.Divider />
          <Menu.Item leftSection={<Pencil size={16} />} disabled={blocked || !template.Id} onClick={() => onAction('rename')}>{t('Перейменувати')}</Menu.Item>
          <Menu.Item leftSection={<Copy size={16} />} disabled={blocked || !template.Id} onClick={() => onAction('copy')}>{t('Створити копію')}</Menu.Item>
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<Trash2 size={16} />} disabled={blocked || !template.Id} onClick={() => onAction('delete')}>{t('Видалити')}</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  </div>
}

function TemplateActionController({ action, titleId, blocked, storage, onNameChange, onRenamed, onDeleted, onComplete }: {
  action: Action; titleId: string; blocked: boolean; storage: Props['storage']
  onNameChange: (name: string) => void; onRenamed: Props['onRenamed']; onDeleted: Props['onDeleted']; onComplete: () => void
}) {
  async function confirmAction() {
    if (blocked || !action.template.Id) return
    const result = action.kind === 'delete' ? await storage.remove(action.template.Id, action.template.Revision)
      : action.kind === 'rename' ? await storage.rename(action.template, action.name)
        : await storage.copy(action.template, action.name)
    if (!result.ok) return
    if (action.kind === 'delete') onDeleted(action.template.Id)
    if (action.kind === 'rename' && result.template) onRenamed(result.template, action.template)
    onComplete()
  }
  return <TemplateActionConfirmation action={action} titleId={titleId} blocked={blocked} busy={storage.busy}
    onNameChange={onNameChange} onConfirm={() => void confirmAction()} onCancel={onComplete} />
}

function SavedTemplatesSection({ templates, datasets, activeId, search, loading, failed, blocked, onApply, onRunSaved, onAction }: {
  templates: ReportTemplate[]; datasets: readonly ReportDataset[]; activeId?: string; search: string; loading: boolean; failed: boolean; blocked: boolean
  onApply: Props['onApply']; onAction: (template: ReportTemplate, kind: Action['kind']) => void; onRunSaved: (template: ReportTemplate) => void
}) {
  const { t } = useI18n()
  const visible = templates.filter(template => template.Name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <section className="reports-stocks-template-saved" aria-label={t('Збережені шаблони')}>
    <Group gap={8}><Text className="reports-stocks-template-section-title" fw={600}>{t('Збережені шаблони')}</Text>
      {loading || failed ? null : <Badge className="app-role-pill is-gray" variant="light">{search.trim() ? `${visible.length} / ${templates.length}` : templates.length}</Badge>}
    </Group>
    {loading ? <Stack role="status" aria-label={t('Завантаження шаблонів')} mt="md"><Skeleton height={82} radius="md" /><Skeleton height={82} radius="md" /></Stack>
      : failed ? null : visible.length ? <div className="reports-stocks-template-list">
        {visible.map(template => <SavedTemplateRow key={template.Id ?? template.Name} template={template} blocked={blocked}
          dataset={datasets.find(dataset => dataset.DataSource === (template.Data.dataSource ?? 0))} active={template.Id === activeId}
          onRunSaved={() => onRunSaved(template)} onApply={() => onApply(template)} onAction={kind => onAction(template, kind)} />)}
      </div> : <div className="reports-stocks-template-empty">
        <span className="reports-stocks-template-empty__icon"><LayoutTemplate size={24} aria-hidden="true" /></span>
        <Text size="sm">{templates.length ? t('Шаблонів за цим пошуком немає') : t('Збережених шаблонів ще немає')}</Text>
      </div>}
  </section>
}
