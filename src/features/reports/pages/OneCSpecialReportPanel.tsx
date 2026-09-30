import { Alert, Button, Card, Select, Stack, Text, TextInput } from '@mantine/core'
import { defaultOneCSpecialSettings, oneCSpecialSpecification, oneCSpecialVersionSupported } from '../data/oneCSpecialReports'
import type { ReportDataset } from '../types'

type Props = { dataSource: number; dataset?: ReportDataset; value: unknown; disabled: boolean; onChange: (value: unknown) => void }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

export function OneCSpecialReportPanel({ dataSource, dataset, value, disabled, onChange }: Props) {
  const spec = oneCSpecialSpecification(dataSource)
  if (!spec) return null
  const settings = record(value) ? value : null
  const versionValid = settings !== null && oneCSpecialVersionSupported(dataSource, settings.Version, dataset)
  const sourceWorld = settings?.SourceWorld === 1 || settings?.SourceWorld === 2 ? String(settings.SourceWorld) : null
  const sourceChoices = spec.worlds.map(world => ({ value: String(world), label: world === 1 ? 'Fenix' : 'AMG' }))
  const sourceValid = sourceWorld !== null && spec.worlds.includes(Number(sourceWorld))
  const set = (patch: Record<string, unknown>) => onChange({ ...settings, ...patch })
  const dateValue = spec.date && typeof settings?.[spec.date] === 'string' ? settings[spec.date] as string : ''
  const title = dataSource === 23 ? 'Знижки й націнки 1С' : dataSource === 24 ? 'Надані знижки 1С'
    : dataSource === 25 ? 'Знижки клієнтів 1С' : 'Аналіз цін 1С'
  return <Card className="app-section-card" withBorder radius="md" padding="md">
    <Stack gap="xs">
      <Text fw={600}>{title}</Text>
      {!versionValid ? <Alert color="red">Налаштування мають невідому версію або пошкоджені. Відновіть початкові поля цього набору.</Alert> : null}
      {!versionValid ? <Button type="button" variant="light" disabled={disabled}
        onClick={() => onChange(defaultOneCSpecialSettings(dataSource, dataset)[spec.key])}>Відновити поля</Button> : null}
      <Select label="База джерела 1С" data={sourceChoices} value={sourceValid ? sourceWorld : null}
        placeholder="Оберіть Fenix або AMG" disabled={disabled || !versionValid}
        allowDeselect={false} onChange={world => { if (world && spec.worlds.includes(Number(world))) set({ SourceWorld: Number(world) }) }} />
      {spec.date ? <TextInput type="date" label={spec.date === 'AsOf' ? 'Дата аналізу цін' : 'Дата стану знижок'}
        min={dataSource === 28 ? '1900-01-01' : '1753-01-01'} max="7999-12-31" value={dateValue}
        disabled={disabled || !versionValid}
        onChange={event => set({ [spec.date!]: event.currentTarget.value })} /> : null}
      <Text size="xs" c="dimmed">Звіт читає локально імпортовані дані обраної бази. Повну відповідність виходу 1С ще не підтверджено.</Text>
      {dataSource === 28 && settings?.Version === 2 ? <Text size="xs" c="dimmed">Для перерахунку цін використовуються курси нашої бази на дату звіту, включно з введеними вручну.</Text> : null}
    </Stack>
  </Card>
}
