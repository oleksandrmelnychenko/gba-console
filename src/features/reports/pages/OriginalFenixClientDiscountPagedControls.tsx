import { Alert, Button, Group, MultiSelect, Stack, Text, TextInput } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { fenixDiscountFields, fenixDiscountLabels, type FenixDiscountChoice, type FenixDiscountField, type FenixDiscountSelection } from '../data/originalFenixClientDiscounts'
import { fenixCaptionsForSelection, type FenixDiscountCatalogue, type FenixSelectedCaptions } from '../data/originalFenixClientDiscountPages'
import { useFenixDiscountChoicePage } from '../hooks/useFenixDiscountChoicePage'
function ChoiceField({ through, names, scope, field, selection, captions, busy, permitted, onSelect }: {
  through: string; names: FenixDiscountCatalogue | null; scope: object; field: FenixDiscountField; selection: readonly string[]; captions: readonly FenixDiscountChoice[];
  busy: boolean; permitted: boolean; onSelect: (field: FenixDiscountField, values: string[], captions: FenixDiscountChoice[]) => void
}) {
  const { t } = useI18n(), [search, setSearch] = useState(''), delivery = useFenixDiscountChoicePage(through, permitted ? names : null, field, scope, selection), page = delivery.page
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (searchTimer.current !== null) clearTimeout(searchTimer.current) }, [scope, names])
  function searchChanged(value: string) {
    setSearch(value); delivery.cancel(); if (searchTimer.current !== null) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { searchTimer.current = null; void delivery.load(value, 0) }, 400)
  }
  function searchNow() { if (searchTimer.current !== null) clearTimeout(searchTimer.current); searchTimer.current = null; void delivery.load(search, 0) }
  const label = t(fenixDiscountLabels[field]), searchDisabled = !permitted || busy || !names?.FieldAvailability[field], disabled = searchDisabled || delivery.busy
  const offered = [...new Map([...captions, ...(page?.SelectedChoices ?? []), ...(page?.Items ?? [])].map(c => [c.Key, c])).values()]
  return <Stack gap="xs"><Group align="end"><TextInput label={`${t('Пошук')}: ${label}`} value={search} maxLength={100} disabled={searchDisabled} onChange={event => searchChanged(event.currentTarget.value)} />
    <Button variant="light" disabled={disabled} loading={delivery.busy} onClick={searchNow}>{t('Шукати')}: {label}</Button></Group>
    <MultiSelect label={label} value={[...selection]} maxValues={256} limit={100} data={offered.map(c => ({ value: c.Key, label: c.Deleted ? `${c.Caption} · ${t('позначено на видалення')}` : c.Caption }))}
      disabled={disabled || !page} onChange={values => { if (page) onSelect(field, values, fenixCaptionsForSelection(page, values)) }} />
    {page ? <Group><Button variant="subtle" disabled={disabled || page.Offset === 0} onClick={() => { void delivery.load(page.Search, Math.max(0, page.Offset - page.Limit)) }}>{t('Попередні назви')}: {label}</Button>
      <Text size="sm">{page.Total ? page.Offset + 1 : 0}–{page.Offset + page.Items.length} / {page.Total} · {t('повний довідник')}: {names?.Counts[field]}</Text>
      <Button variant="subtle" disabled={disabled || page.NextOffset === null} onClick={() => { if (page.NextOffset !== null) void delivery.load(page.Search, page.NextOffset) }}>{t('Наступні назви')}: {label}</Button></Group> : null}
    {delivery.error ? <Alert color="red">{t(delivery.error)}</Alert> : null}</Stack>
}
export function OriginalFenixClientDiscountPagedControls({ through, names, scope, selection, captions, busy, permitted, dateError, error, loading, onLoad, onSelect }: {
  through: string; names: FenixDiscountCatalogue | null; scope: object; selection: FenixDiscountSelection; captions: FenixSelectedCaptions; busy: boolean; permitted: boolean; dateError: string | null; error: string | null;
  loading: boolean; onLoad: () => void; onSelect: (field: FenixDiscountField, values: string[], captions: FenixDiscountChoice[]) => void
}) {
  const { t } = useI18n()
  return <Stack gap="xs"><Button variant="light" disabled={!permitted || !!dateError || busy} loading={loading} onClick={onLoad}>{t('Завантажити актуальні назви')}</Button>
    {fenixDiscountFields.map(field => <ChoiceField key={`${field}:${names?.ResultSha256 ?? 'unloaded'}`} through={through} names={names} scope={scope} field={field} selection={selection[field]} captions={captions[field]}
      busy={busy} permitted={permitted} onSelect={onSelect} />)}
    {error ? <Alert color="red">{t(error)}</Alert> : null}
    {names?.MissingFamilies.length ? <Text size="sm" c="dimmed">{t('Назви ще недоступні')}: {names.MissingFamilies.map(f => t(fenixDiscountLabels[f])).join(', ')}.</Text> : null}
  </Stack>
}
