import { Alert, Anchor, Box, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, FileText, Truck } from 'lucide-react'
import { ExcelIcon } from '../../../shared/ui/ExcelIcon'
import { useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import {
  addSaleConsignmentNoteSetting,
  getSaleConsignmentNoteSettings,
  printSaleConsignmentNoteDocument,
  removeSaleConsignmentNoteSetting,
  updateSaleConsignmentNoteSetting,
} from '../api/salesUkraineApi'
import type { SaleConsignmentDocument, SaleConsignmentNoteSetting, SalesUkraineSale } from '../types'
import './sales-drawers.css'

type ConsignmentNoteDrawerState = {
  error: string | null
  isEdited: boolean
  savedSetting: SaleConsignmentNoteSetting
  selectedSettingKey: string | null
  setting: SaleConsignmentNoteSetting
}

export function ConsignmentNoteSettingsDrawer({
  opened,
  sale,
  onClose,
}: {
  onClose: () => void
  opened: boolean
  sale: SalesUkraineSale | null
}) {
  const { t } = useI18n()
  const defaultSetting = useMemo(() => buildDefaultConsignmentNoteSetting(sale), [sale])
  const [settings, setSettings] = useValueState<SaleConsignmentNoteSetting[]>([])
  const [noteState, setNoteState] = useValueState<ConsignmentNoteDrawerState>(() =>
    createConsignmentNoteDrawerState(defaultSetting),
  )
  const [isLoading, setLoading] = useValueState(false)
  const [isSaving, setSaving] = useValueState(false)
  const [isPrinting, setPrinting] = useValueState(false)
  const [downloadDocument, setDownloadDocument] = useValueState<SaleConsignmentDocument | null>(null)
  const [downloadModalOpened, setDownloadModalOpened] = useValueState(false)
  const settingOptions = useMemo(() => buildConsignmentSettingOptions(settings), [settings])
  const hasExistingSetting = Boolean(noteState.setting.NetUid || noteState.setting.Id)

  useEffect(() => {
    if (!opened) {
      return
    }

    let cancelled = false

    setNoteState(createConsignmentNoteDrawerState(defaultSetting))

    async function loadSettings() {
      setLoading(true)

      try {
        const nextSettings = await getSaleConsignmentNoteSettings()

        if (!cancelled) {
          setSettings(nextSettings)
        }
      } catch (loadError) {
        if (!cancelled) {
          setNoteState((currentState) => ({
            ...currentState,
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити налаштування ТТН'),
          }))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [defaultSetting, opened, setLoading, setNoteState, setSettings, t])

  function selectSetting(value: string | null) {
    if (!value) {
      setNoteState(createConsignmentNoteDrawerState(defaultSetting))

      return
    }

    const selectedSetting = settings.find((item) => getConsignmentSettingKey(item) === value)

    if (!selectedSetting) {
      return
    }

    const nextSetting = applyConsignmentDocumentDefaults(selectedSetting, defaultSetting)

    setNoteState({ error: null, isEdited: false, savedSetting: nextSetting, selectedSettingKey: value, setting: nextSetting })
  }

  function updateTextField(field: keyof SaleConsignmentNoteSetting, value: string) {
    setNoteState((currentState) => ({
      ...currentState,
      isEdited: true,
      setting: { ...currentState.setting, [field]: value },
    }))
  }

  function updateNumberField(field: keyof SaleConsignmentNoteSetting, value: number | string) {
    setNoteState((currentState) => ({
      ...currentState,
      isEdited: true,
      setting: { ...currentState.setting, [field]: toNumber(value) },
    }))
  }

  function resetChanges() {
    setNoteState((currentState) => ({ ...currentState, error: null, isEdited: false, setting: currentState.savedSetting }))
  }

  async function saveSetting() {
    const validationError = getConsignmentValidationError(noteState.setting, t)

    if (validationError) {
      setNoteState((currentState) => ({ ...currentState, error: validationError }))

      return
    }

    setSaving(true)
    setNoteState((currentState) => ({ ...currentState, error: null }))

    try {
      const nextSettings = hasExistingSetting
        ? await updateSaleConsignmentNoteSetting(noteState.setting)
        : await addSaleConsignmentNoteSetting(noteState.setting)
      const nextSetting = applyConsignmentDocumentDefaults(
        findMatchingConsignmentSetting(nextSettings, noteState.setting) || noteState.setting,
        defaultSetting,
      )

      setSettings(nextSettings)
      setNoteState({
        error: null,
        isEdited: false,
        savedSetting: nextSetting,
        selectedSettingKey: getConsignmentSettingKey(nextSetting),
        setting: nextSetting,
      })
      notifications.show({
        color: 'green',
        message: hasExistingSetting ? t('Налаштування ТТН збережено') : t('Налаштування ТТН створено'),
      })
    } catch (saveError) {
      setNoteState((currentState) => ({
        ...currentState,
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти налаштування ТТН'),
      }))
    } finally {
      setSaving(false)
    }
  }

  async function deleteSetting() {
    if (!noteState.setting.NetUid) {
      setNoteState((currentState) => ({ ...currentState, error: t('Налаштування без NetUid не можна видалити') }))

      return
    }

    setSaving(true)
    setNoteState((currentState) => ({ ...currentState, error: null }))

    try {
      const nextSettings = await removeSaleConsignmentNoteSetting(noteState.setting.NetUid)

      setSettings(nextSettings)
      setNoteState(createConsignmentNoteDrawerState(defaultSetting))
      notifications.show({ color: 'green', message: t('Налаштування ТТН видалено') })
    } catch (deleteError) {
      setNoteState((currentState) => ({
        ...currentState,
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити налаштування ТТН'),
      }))
    } finally {
      setSaving(false)
    }
  }

  async function printDocument() {
    const validationError = getConsignmentValidationError(noteState.setting, t)

    if (validationError) {
      setNoteState((currentState) => ({ ...currentState, error: validationError }))

      return
    }

    if (!sale?.NetUid) {
      setNoteState((currentState) => ({ ...currentState, error: t('Не вказано продаж для друку ТТН') }))

      return
    }

    setPrinting(true)
    setNoteState((currentState) => ({ ...currentState, error: null }))

    try {
      const document = await printSaleConsignmentNoteDocument(sale.NetUid, noteState.setting)

      setDownloadDocument(document)
      setDownloadModalOpened(true)
    } catch (printError) {
      setNoteState((currentState) => ({
        ...currentState,
        error: printError instanceof Error ? printError.message : t('Не вдалося сформувати ТТН'),
      }))
    } finally {
      setPrinting(false)
    }
  }

  return (
    <AppDrawer
      offset={8}
      opened={opened}
      padding="lg"
      position="right"
      radius="md"
      size="min(760px, 96vw)"
      title={t('Друк ТТН')}
      onClose={onClose}
    >
      <Stack gap="lg">
        {noteState.error && (
          <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
            {noteState.error}
          </Alert>
        )}

        <Group className="sales-drawer-hero" align="end" gap="sm">
          <Box style={{ flex: '1 1 260px' }}>
            <Text className="sales-drawer-document-label">
              {t('По документу')}
            </Text>
            <Text className="sales-drawer-document-title">
              {t('Накладна')} {displayValue(sale?.SaleNumber?.Value)} {t('від')} {formatDateTime(getConsignmentNoteDate(sale))}
            </Text>
          </Box>
          <Select
            clearable
            searchable
            data={settingOptions}
            disabled={isLoading}
            label={t('Існуючі налаштування')}
            placeholder={t('Обрати')}
            style={{ flex: '1 1 260px' }}
            value={noteState.selectedSettingKey}
            onChange={selectSetting}
          />
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <TextInput
            label={t('Назва')}
            maxLength={200}
            value={noteState.setting.Name || ''}
            onChange={(event) => updateTextField('Name', event.currentTarget.value)}
          />
          <TextInput
            label={t('Номер')}
            value={noteState.setting.Number || ''}
            onChange={(event) => updateTextField('Number', event.currentTarget.value)}
          />
          <TextInput
            label={t('Марка та номер автомобіля')}
            maxLength={200}
            value={noteState.setting.BrandAndNumberCar || ''}
            onChange={(event) => updateTextField('BrandAndNumberCar', event.currentTarget.value)}
          />
          <TextInput
            label={t('Номер причепа')}
            maxLength={200}
            value={noteState.setting.TrailerNumber || ''}
            onChange={(event) => updateTextField('TrailerNumber', event.currentTarget.value)}
          />
          <TextInput
            label={t('Замовник')}
            maxLength={200}
            value={noteState.setting.Customer || ''}
            onChange={(event) => updateTextField('Customer', event.currentTarget.value)}
          />
          <TextInput
            label={t('Водій')}
            maxLength={200}
            value={noteState.setting.Driver || ''}
            onChange={(event) => updateTextField('Driver', event.currentTarget.value)}
          />
          <TextInput
            label={t('Перевізник')}
            maxLength={200}
            value={noteState.setting.Carrier || ''}
            onChange={(event) => updateTextField('Carrier', event.currentTarget.value)}
          />
          <TextInput
            label={t('Вид перевозки')}
            maxLength={200}
            value={noteState.setting.TypeTransportation || ''}
            onChange={(event) => updateTextField('TypeTransportation', event.currentTarget.value)}
          />
          <TextInput
            label={t('Пункт розвантаження')}
            maxLength={500}
            value={noteState.setting.UnloadingPoint || ''}
            onChange={(event) => updateTextField('UnloadingPoint', event.currentTarget.value)}
          />
          <TextInput
            label={t('Пункт завантаження')}
            maxLength={500}
            value={noteState.setting.LoadingPoint || ''}
            onChange={(event) => updateTextField('LoadingPoint', event.currentTarget.value)}
          />
        </SimpleGrid>

        <Stack gap="sm">
          <Text fw={700}>{t('Автомобіль')}</Text>
          <TextInput
            label={t('Заголовок')}
            maxLength={200}
            value={noteState.setting.CarLabel || ''}
            onChange={(event) => updateTextField('CarLabel', event.currentTarget.value)}
          />
          <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
            <NumberInput label={t('Довжина, мм')} value={noteState.setting.CarLength || 0} onChange={(value) => updateNumberField('CarLength', value)} />
            <NumberInput label={t('Ширина, мм')} value={noteState.setting.CarWidth || 0} onChange={(value) => updateNumberField('CarWidth', value)} />
            <NumberInput label={t('Висота, мм')} value={noteState.setting.CarHeight || 0} onChange={(value) => updateNumberField('CarHeight', value)} />
            <NumberInput label={t('Вага нетто, т')} value={noteState.setting.CarNetWeight || 0} onChange={(value) => updateNumberField('CarNetWeight', value)} />
            <NumberInput label={t('Вага брутто, т')} value={noteState.setting.CarGrossWeight || 0} onChange={(value) => updateNumberField('CarGrossWeight', value)} />
          </SimpleGrid>
        </Stack>

        <Stack gap="sm">
          <Text fw={700}>{t('Причіп')}</Text>
          <TextInput
            label={t('Заголовок')}
            maxLength={200}
            value={noteState.setting.TrailerLabel || ''}
            onChange={(event) => updateTextField('TrailerLabel', event.currentTarget.value)}
          />
          <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
            <NumberInput label={t('Довжина, мм')} value={noteState.setting.TrailerLength || 0} onChange={(value) => updateNumberField('TrailerLength', value)} />
            <NumberInput label={t('Ширина, мм')} value={noteState.setting.TrailerWidth || 0} onChange={(value) => updateNumberField('TrailerWidth', value)} />
            <NumberInput label={t('Висота, мм')} value={noteState.setting.TrailerHeight || 0} onChange={(value) => updateNumberField('TrailerHeight', value)} />
            <NumberInput label={t('Вага нетто, т')} value={noteState.setting.TrailerNetWeight || 0} onChange={(value) => updateNumberField('TrailerNetWeight', value)} />
            <NumberInput label={t('Вага брутто, т')} value={noteState.setting.TrailerGrossWeight || 0} onChange={(value) => updateNumberField('TrailerGrossWeight', value)} />
          </SimpleGrid>
        </Stack>

        <Group justify="flex-end">
          <Button color="gray" disabled={!noteState.isEdited || isSaving} variant="light" onClick={resetChanges}>
            {t('Скасувати')}
          </Button>
          {hasExistingSetting && (
            <Button color="red" disabled={isSaving || isPrinting} variant="light" onClick={deleteSetting}>
              {t('Видалити')}
            </Button>
          )}
          <Button disabled={!noteState.isEdited || isPrinting} loading={isSaving} variant="outline" onClick={saveSetting}>
            {hasExistingSetting ? t('Зберегти') : t('Створити')}
          </Button>
          <Button leftSection={<Truck size={16} />} loading={isPrinting} onClick={printDocument}>
            {t('Друк')}
          </Button>
        </Group>
      </Stack>

      <DownloadDocumentModal
        document={downloadDocument}
        opened={downloadModalOpened}
        title={t('ТТН')}
        onClose={() => setDownloadModalOpened(false)}
      />
    </AppDrawer>
  )
}

function DownloadDocumentModal({
  document,
  opened,
  title,
  onClose,
}: {
  document: SaleConsignmentDocument | null
  onClose: () => void
  opened: boolean
  title: string
}) {
  const { t } = useI18n()
  const excelUrl = toSecure(document?.DocumentURL)
  const pdfUrl = toSecure(document?.PdfDocumentURL)

  return (
    <AppModal centered opened={opened} title={title} onClose={onClose}>
      <Stack gap="sm">
        {excelUrl || pdfUrl ? (
          <>
            {excelUrl && (
              <Anchor href={excelUrl} target="_blank" rel="noopener noreferrer">
                <Group gap="xs">
                  <ExcelIcon size={20} />
                  <Text>{t('Excel документ')}</Text>
                </Group>
              </Anchor>
            )}
            {pdfUrl && (
              <Anchor href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Group gap="xs">
                  <FileText size={20} />
                  <Text>{t('PDF документ')}</Text>
                </Group>
              </Anchor>
            )}
          </>
        ) : (
          <Text c="dimmed" size="sm">
            {t('Документ недоступний для завантаження')}
          </Text>
        )}
      </Stack>
    </AppModal>
  )
}

function buildDefaultConsignmentNoteSetting(sale: SalesUkraineSale | null): SaleConsignmentNoteSetting {
  return {
    BrandAndNumberCar: '',
    CarGrossWeight: 0,
    CarHeight: 0,
    CarLabel: 'Автомобіль',
    CarLength: 0,
    CarNetWeight: 0,
    Carrier: '',
    CarWidth: 0,
    Customer: '',
    Driver: '',
    Id: 0,
    LoadingPoint: getConsignmentLoadingPoint(sale),
    Name: '',
    Number: buildConsignmentNoteNumber(sale?.SaleNumber?.Value),
    TrailerGrossWeight: 0,
    TrailerHeight: 0,
    TrailerLabel: 'Причеп/Напівпричеп',
    TrailerLength: 0,
    TrailerNetWeight: 0,
    TrailerNumber: '',
    TrailerWidth: 0,
    TypeTransportation: '',
    UnloadingPoint: '',
  }
}

function createConsignmentNoteDrawerState(defaultSetting: SaleConsignmentNoteSetting): ConsignmentNoteDrawerState {
  return { error: null, isEdited: false, savedSetting: defaultSetting, selectedSettingKey: null, setting: defaultSetting }
}

function buildConsignmentNoteNumber(saleNumber?: string): string {
  const numberPart = saleNumber?.replace(/[^0-9]/g, '')

  return numberPart ? `P${Number.parseInt(numberPart, 10)}` : 'P'
}

function getConsignmentLoadingPoint(sale: SalesUkraineSale | null): string {
  return sale?.ClientAgreement?.Agreement?.Organization?.Address || ''
}

function getConsignmentNoteDate(sale: SalesUkraineSale | null): Date | string | undefined {
  return sale?.ChangedToInvoice || sale?.FromDate || sale?.Created
}

function applyConsignmentDocumentDefaults(
  setting: SaleConsignmentNoteSetting,
  defaults: SaleConsignmentNoteSetting,
): SaleConsignmentNoteSetting {
  return { ...defaults, ...setting, LoadingPoint: defaults.LoadingPoint, Number: defaults.Number }
}

function buildConsignmentSettingOptions(settings: SaleConsignmentNoteSetting[]): Array<{ label: string; value: string }> {
  return settings.reduce<Array<{ label: string; value: string }>>((options, setting) => {
    const value = getConsignmentSettingKey(setting)

    if (value) {
      options.push({ label: setting.Name || translate('Без назви'), value })
    }

    return options
  }, [])
}

function getConsignmentSettingKey(setting: SaleConsignmentNoteSetting): string {
  return setting.NetUid || (typeof setting.Id === 'number' && setting.Id > 0 ? String(setting.Id) : '')
}

function findMatchingConsignmentSetting(
  settings: SaleConsignmentNoteSetting[],
  source: SaleConsignmentNoteSetting,
): SaleConsignmentNoteSetting | undefined {
  const sourceKey = getConsignmentSettingKey(source)

  if (sourceKey) {
    return settings.find((setting) => getConsignmentSettingKey(setting) === sourceKey)
  }

  return settings.find((setting) => setting.Name === source.Name && setting.Number === source.Number)
}

function getConsignmentValidationError(setting: SaleConsignmentNoteSetting, t: (value: string) => string): string | null {
  if (!setting.Name) {
    return t('Вкажіть назву')
  }

  if (!setting.BrandAndNumberCar) {
    return t('Вкажіть марку та номер автомобіля')
  }

  if (!setting.Driver) {
    return t('Вкажіть водія')
  }

  if (!setting.LoadingPoint) {
    return t('Вкажіть пункт завантаження')
  }

  if (!setting.UnloadingPoint) {
    return t('Вкажіть пункт розвантаження')
  }

  return null
}

function toNumber(value: number | string): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const parsed = Number(String(value).replace(',', '.'))

  return Number.isFinite(parsed) ? parsed : 0
}

function toSecure(url?: string): string | null {
  if (!url) {
    return null
  }

  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url
}

function formatDateTime(value?: Date | string): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('uk-UA')
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  return ''
}
