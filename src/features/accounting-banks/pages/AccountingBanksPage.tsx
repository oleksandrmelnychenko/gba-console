import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { PermissionGate } from '../../auth/components/PermissionGate'
import { translate } from '../../../shared/i18n/translate'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import { getAccountingBanks, saveAccountingBank } from '../api/accountingBanksApi'
import type { AccountingBank, AccountingBankFormValues } from '../types'

const ACCOUNTING_BANK_CREATE_PERMISSION = 'Accounting_Banks_All_ADDBtn_PKEY'
const ACCOUNTING_BANK_SAVE_PERMISSION = 'Accounting_Banks_All_Modal_edit_SaveBtn_PKEY'
const ACCOUNTING_BANK_DELETE_PERMISSION = 'Accounting_Banks_All_Modal_edit_DelBtn_PKEY'

const ACCOUNTING_BANKS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['name'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const EMPTY_FORM_VALUES: AccountingBankFormValues = {
  address: '',
  city: '',
  edrpouCode: '',
  mfoCode: '',
  name: '',
  phones: '',
}

export function AccountingBanksPage() {
  const { t } = useI18n()
  const [banks, setBanks] = useState<AccountingBank[]>([])
  const [searchDraft, setSearchDraft] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [editingBank, setEditingBank] = useState<AccountingBank | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AccountingBank | null>(null)
  const [formValues, setFormValues] = useState<AccountingBankFormValues>(EMPTY_FORM_VALUES)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isEditorOpen, setEditorOpen] = useState(false)
  const [isLoading, setLoading] = useState(true)
  const [isSaving, setSaving] = useState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)
  const visibleBanks = useMemo(() => filterBanks(banks, searchValue), [banks, searchValue])
  const openEditor = useCallback((bank?: AccountingBank) => {
    setEditingBank(bank || null)
    setFormValues(bankToFormValues(bank))
    setFormError(null)
    setEditorOpen(true)
  }, [])
  const requestDelete = useCallback((bank: AccountingBank) => {
    setDeleteTarget(bank)
    setEditorOpen(false)
    setFormError(null)
  }, [])
  const columns = useAccountingBankColumns(openEditor, requestDelete)
  const toolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {t('Показано')} {visibleBanks.length} {t('з')} {banks.length}
        {searchValue ? `, ${t('пошук')}: ${searchValue}` : ''}
      </Text>
    ),
    [banks.length, searchValue, t, visibleBanks.length],
  )

  useEffect(() => {
    let cancelled = false

    async function loadBanks() {
      setLoading(true)
      setError(null)

      try {
        const nextBanks = await getAccountingBanks()

        if (!cancelled) {
          setBanks(nextBanks)
        }
      } catch (loadError) {
        if (!cancelled) {
          setBanks([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити банки'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadBanks()

    return () => {
      cancelled = true
    }
  }, [reloadKey, t])

  function updateSearch(nextSearchValue: string) {
    setSearchDraft(nextSearchValue)
    setSearchValue(nextSearchValue.trim())
  }

  function resetSearch() {
    setSearchDraft('')
    setSearchValue('')
  }

  function closeEditor() {
    if (isSaving) {
      return
    }

    setEditorOpen(false)
    setEditingBank(null)
    setFormValues(EMPTY_FORM_VALUES)
    setFormError(null)
  }

  function setFormField<K extends keyof AccountingBankFormValues>(key: K, value: AccountingBankFormValues[K]) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  async function handleSaveBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = buildBankPayload(editingBank, formValues)
    const validationError = validateBank(payload)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextBanks = await saveAccountingBank(payload)

      setBanks(nextBanks)
      notifications.show({
        color: 'green',
        message: editingBank?.Id ? t('Банк оновлено') : t('Банк створено'),
      })
      closeEditor()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти банк'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBank() {
    if (!deleteTarget) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextBanks = await saveAccountingBank({
        ...deleteTarget,
        Deleted: true,
      })

      setBanks(nextBanks)
      notifications.show({ color: 'green', message: t('Банк видалено') })
      setDeleteTarget(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити банк'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
            <TextInput
              leftSection={<IconSearch size={16} />}
              label={t('Пошук')}
              placeholder={t('Назва, МФО, ЄДРПОУ, місто, телефон або адреса')}
              value={searchDraft}
              onChange={(event) => updateSearch(event.currentTarget.value)}
              style={{ flex: '1 1 auto', minWidth: 180 }}
            />
            <Tooltip label={t('Скинути')}>
              <ActionIcon
                aria-label={t('Скинути')}
                color="gray"
                size={36}
                style={{ flex: '0 0 auto' }}
                type="button"
                variant="light"
                onClick={resetSearch}
              >
                <IconRestore size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={36}
                style={{ flex: '0 0 auto' }}
                variant="light"
                onClick={reload}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <PermissionGate permissionKey={ACCOUNTING_BANK_CREATE_PERMISSION}>
              <Button
                color="violet"
                leftSection={<IconPlus size={16} />}
                type="button"
                onClick={() => openEditor()}
                style={{ flex: '0 0 auto' }}
              >
                {t('Новий банк')}
              </Button>
            </PermissionGate>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={visibleBanks}
            defaultLayout={ACCOUNTING_BANKS_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Банків не знайдено')}
            getRowId={(bank, index) => String(bank.NetUid || bank.Id || index)}
            isLoading={isLoading}
            layoutVersion="accounting-banks-table-1"
            loadingText={t('Завантаження банків')}
            maxHeight="calc(100vh - 320px)"
            minWidth={1180}
            tableId="accounting-banks"
            toolbarLeft={toolbarLeft}
            onRowClick={openEditor}
          />
        </Stack>
      </Card>

      <BankEditorModal
        bank={editingBank}
        error={formError}
        isOpen={isEditorOpen}
        isSaving={isSaving}
        values={formValues}
        onClose={closeEditor}
        onDelete={requestDelete}
        onFieldChange={setFormField}
        onSubmit={handleSaveBank}
      />

      <BankDeleteModal
        bank={deleteTarget}
        isSaving={isSaving}
        onClose={() => setDeleteTarget(null)}
        onDelete={handleDeleteBank}
      />
    </Stack>
  )
}

type BankEditorModalProps = {
  bank: AccountingBank | null
  error: string | null
  isOpen: boolean
  isSaving: boolean
  values: AccountingBankFormValues
  onClose: () => void
  onDelete: (bank: AccountingBank) => void
  onFieldChange: <K extends keyof AccountingBankFormValues>(key: K, value: AccountingBankFormValues[K]) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function BankEditorModal({
  bank,
  error,
  isOpen,
  isSaving,
  values,
  onClose,
  onDelete,
  onFieldChange,
  onSubmit,
}: BankEditorModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={isOpen} size="lg" title={bank?.Id ? t('Редагування банку') : t('Новий банк')} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}
          <TextInput
            disabled={isSaving}
            label={t('Назва')}
            maxLength={180}
            required
            value={values.name}
            onChange={(event) => onFieldChange('name', event.currentTarget.value)}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              disabled={isSaving}
              label={t('МФО')}
              maxLength={6}
              required
              value={values.mfoCode}
              onChange={(event) => onFieldChange('mfoCode', event.currentTarget.value)}
            />
            <TextInput
              disabled={isSaving}
              label={t('ЄДРПОУ')}
              maxLength={20}
              required
              value={values.edrpouCode}
              onChange={(event) => onFieldChange('edrpouCode', event.currentTarget.value)}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              disabled={isSaving}
              label={t('Місто')}
              maxLength={120}
              value={values.city}
              onChange={(event) => onFieldChange('city', event.currentTarget.value)}
            />
            <TextInput
              disabled={isSaving}
              label={t('Телефон')}
              maxLength={120}
              value={values.phones}
              onChange={(event) => onFieldChange('phones', event.currentTarget.value)}
            />
          </SimpleGrid>
          <TextInput
            disabled={isSaving}
            label={t('Адреса')}
            maxLength={240}
            value={values.address}
            onChange={(event) => onFieldChange('address', event.currentTarget.value)}
          />
          <Group justify="space-between">
            <Box>
              {bank?.Id && (
                <PermissionGate permissionKey={ACCOUNTING_BANK_DELETE_PERMISSION}>
                  <Button
                    color="red"
                    disabled={isSaving}
                    leftSection={<IconTrash size={16} />}
                    type="button"
                    variant="subtle"
                    onClick={() => onDelete(bank)}
                  >
                    {t('Видалити')}
                  </Button>
                </PermissionGate>
              )}
            </Box>
            <Group gap="xs">
              <Button color="gray" disabled={isSaving} type="button" variant="subtle" onClick={onClose}>
                {t('Скасувати')}
              </Button>
              <PermissionGate permissionKey={ACCOUNTING_BANK_SAVE_PERMISSION}>
                <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
                  {t('Зберегти')}
                </Button>
              </PermissionGate>
            </Group>
          </Group>
        </Stack>
      </form>
    </AppModal>
  )
}

type BankDeleteModalProps = {
  bank: AccountingBank | null
  isSaving: boolean
  onClose: () => void
  onDelete: () => void
}

function BankDeleteModal({ bank, isSaving, onClose, onDelete }: BankDeleteModalProps) {
  const { t } = useI18n()

  return (
    <AppModal centered opened={Boolean(bank)} title={t('Видалити банк')} onClose={onClose}>
      <Stack gap="md">
        <Text>{bank ? t('Банк "{name}" буде позначено як видалений.', { name: getBankName(bank) }) : ''}</Text>
        <Group justify="flex-end">
          <Button color="gray" disabled={isSaving} variant="subtle" onClick={onClose}>
            {t('Скасувати')}
          </Button>
          <Button color="red" loading={isSaving} onClick={onDelete}>
            {t('Видалити')}
          </Button>
        </Group>
      </Stack>
    </AppModal>
  )
}

function useAccountingBankColumns(
  openEditor: (bank: AccountingBank) => void,
  requestDelete: (bank: AccountingBank) => void,
): DataTableColumn<AccountingBank>[] {
  const { t } = useI18n()

  return useMemo<DataTableColumn<AccountingBank>[]>(
    () => [
      {
        id: 'name',
        header: 'Назва',
        width: 260,
        minWidth: 220,
        accessor: (bank) => bank.Name,
        cell: (bank) => <Text fw={600}>{displayValue(bank.Name)}</Text>,
      },
      {
        id: 'mfoCode',
        header: 'МФО',
        width: 140,
        minWidth: 120,
        accessor: (bank) => bank.MfoCode,
        cell: (bank) => displayValue(bank.MfoCode),
      },
      {
        id: 'edrpouCode',
        header: 'ЄДРПОУ',
        width: 150,
        minWidth: 132,
        accessor: (bank) => bank.EdrpouCode,
        cell: (bank) => displayValue(bank.EdrpouCode),
      },
      {
        id: 'city',
        header: 'Місто',
        width: 180,
        minWidth: 140,
        accessor: (bank) => bank.City,
        cell: (bank) => displayValue(bank.City),
      },
      {
        id: 'phones',
        header: 'Телефон',
        width: 180,
        minWidth: 140,
        accessor: (bank) => bank.Phones,
        cell: (bank) => displayValue(bank.Phones),
      },
      {
        id: 'address',
        header: 'Адреса',
        width: 280,
        minWidth: 200,
        accessor: (bank) => bank.Address,
        cell: (bank) => displayValue(bank.Address),
      },
      {
        id: 'actions',
        header: '',
        width: 94,
        minWidth: 94,
        maxWidth: 94,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (bank) => (
          <Group gap={4} justify="center" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color="gray"
                variant="subtle"
                onClick={() => openEditor(bank)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
            <PermissionGate permissionKey={ACCOUNTING_BANK_DELETE_PERMISSION}>
              <Tooltip label={t('Видалити')}>
                <ActionIcon
                  aria-label={t('Видалити')}
                  color="red"
                  disabled={!bank.Id}
                  variant="subtle"
                  onClick={() => requestDelete(bank)}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            </PermissionGate>
          </Group>
        ),
      },
    ],
    [openEditor, requestDelete, t],
  )
}

function bankToFormValues(bank?: AccountingBank): AccountingBankFormValues {
  if (!bank) {
    return EMPTY_FORM_VALUES
  }

  return {
    address: bank.Address || '',
    city: bank.City || '',
    edrpouCode: bank.EdrpouCode || '',
    mfoCode: bank.MfoCode || '',
    name: bank.Name || '',
    phones: bank.Phones || '',
  }
}

function buildBankPayload(bank: AccountingBank | null, values: AccountingBankFormValues): AccountingBank {
  return {
    ...(bank || {}),
    Address: values.address.trim(),
    City: values.city.trim(),
    EdrpouCode: values.edrpouCode.trim(),
    MfoCode: values.mfoCode.trim(),
    Name: values.name.trim(),
    Phones: values.phones.trim(),
  }
}

function validateBank(bank: AccountingBank): string | null {
  if (!bank.Name?.trim()) {
    return translate('Вкажіть назву')
  }

  if (!bank.MfoCode?.trim()) {
    return translate('Вкажіть МФО')
  }

  if (bank.MfoCode.trim().length !== 6) {
    return translate('МФО має містити 6 символів')
  }

  if (!bank.EdrpouCode?.trim()) {
    return translate('Вкажіть ЄДРПОУ')
  }

  return null
}

function filterBanks(banks: AccountingBank[], searchValue: string): AccountingBank[] {
  const normalizedSearch = searchValue.trim().toLocaleLowerCase('uk')

  if (!normalizedSearch) {
    return banks
  }

  return banks.filter((bank) =>
    [bank.Name, bank.MfoCode, bank.EdrpouCode, bank.City, bank.Phones, bank.Address, bank.NetUid, bank.Id].some(
      (value) => String(value ?? '').toLocaleLowerCase('uk').includes(normalizedSearch),
    ),
  )
}

function getBankName(bank: AccountingBank): string {
  return bank.Name?.trim() || translate('Без назви')
}

function displayValue(value?: number | string | null): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-'
  }

  const normalized = value?.trim()
  return normalized || '-'
}
