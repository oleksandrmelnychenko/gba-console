import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  FileInput,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core'
import { AppDrawer } from "../../../shared/ui/AppDrawer"
import { AppModal } from "../../../shared/ui/AppModal"
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconDeviceFloppy,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { type FormEvent, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import type { TranslationKey } from '../../../shared/i18n/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DataTable } from '../../../shared/ui/data-table/DataTable'
import type { DataTableColumn, DataTableDefaultLayout } from '../../../shared/ui/data-table/types'
import {
  addEcommerceStorage,
  createSeoContact,
  getAllOnlineShopStorages,
  getEcommerceStorages,
  getOnlineShopSeoSettings,
  getOnlineShopClients,
  getOnlineShopPaymentRegisters,
  removeEcommerceStorage,
  removeSeoContact,
  selectOnlineShopPaymentRegister,
  toggleOnlineShopClient,
  updateSeoContact,
  updateSeoContactInfo,
  updateEcommerceStoragePriority,
  updateSeoPage,
  updateSeoPaymentInfo,
  uploadSeoContactImage,
} from '../api/onlineShopSeoApi'
import {
  ContactInfoForm,
  LocaleAccordion,
  PaymentInfoForm,
  SearchToolbar,
  StatusBadge,
} from '../components/OnlineShopSeoControls'
import type {
  OnlineShopClient,
  OnlineShopPaymentRegister,
  OnlineShopStorage,
  SeoContact,
  SeoContactFormValues,
  SeoContactInfo,
  SeoContactInfoFormValues,
  SeoLocaleEntry,
  SeoPageRow,
  SeoPaymentFormValues,
  SeoRetailPaymentInfo,
} from '../types'
import {
  contactToFormValues,
  displayValue,
  formatDateTime,
  getAllPageRows,
  getLocaleLabel,
  getPageTitle,
  getUniqueContacts,
  hasPaymentRecord,
  pageToFormValues,
  validateContact,
  validatePage,
} from '../utils'

const SEO_PAGES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['locale', 'page'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const SEO_CONTACTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['contact'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const ONLINE_SHOP_CLIENTS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'client'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const PAYMENT_REGISTERS_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'accountNumber'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const ECOMMERCE_STORAGES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['priority', 'storage'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

const ALL_STORAGES_TABLE_DEFAULT_LAYOUT = {
  columnPinning: {
    left: ['status', 'storage'],
    right: ['actions'],
  },
  density: 'normal',
} satisfies DataTableDefaultLayout

type SeoTab = 'pages' | 'contact-info' | 'contacts' | 'payment' | 'shop-clients' | 'bank-cards' | 'warehouses'

const SEO_TABS: { value: SeoTab; label: TranslationKey }[] = [
  { value: 'pages', label: 'Сторінки' },
  { value: 'contact-info', label: 'Загальна інформація' },
  { value: 'contacts', label: 'Персонал' },
  { value: 'payment', label: 'Оплата' },
  { value: 'shop-clients', label: 'Інтернет клієнти' },
  { value: 'bank-cards', label: 'Банківські картки' },
  { value: 'warehouses', label: 'Склади' },
]

const EMPTY_PAGE_FORM_VALUES = pageToFormValues(null)
const EMPTY_CONTACT_FORM_VALUES = contactToFormValues(null)

function useOnlineShopSeoPageModel() {
  const { t } = useI18n()
  const [settings, setSettings] = useValueState<SeoLocaleEntry[]>([])
  const [activeTab, setActiveTab] = useValueState<SeoTab>('pages')
  const [pageSearchDraft, setPageSearchDraft] = useValueState('')
  const [pageSearchValue, setPageSearchValue] = useValueState('')
  const [contactSearchDraft, setContactSearchDraft] = useValueState('')
  const [contactSearchValue, setContactSearchValue] = useValueState('')
  const [clientSearchDraft, setClientSearchDraft] = useValueState('')
  const [clientSearchValue, setClientSearchValue] = useValueState('')
  const [cardSearchDraft, setCardSearchDraft] = useValueState('')
  const [cardSearchValue, setCardSearchValue] = useValueState('')
  const [storageSearchDraft, setStorageSearchDraft] = useValueState('')
  const [storageSearchValue, setStorageSearchValue] = useValueState('')
  const [allStorageSearchDraft, setAllStorageSearchDraft] = useValueState('')
  const [allStorageSearchValue, setAllStorageSearchValue] = useValueState('')
  const [onlineShopClients, setOnlineShopClients] = useValueState<OnlineShopClient[]>([])
  const [paymentRegisters, setPaymentRegisters] = useValueState<OnlineShopPaymentRegister[]>([])
  const [ecommerceStorages, setEcommerceStorages] = useValueState<OnlineShopStorage[]>([])
  const [allStorages, setAllStorages] = useValueState<OnlineShopStorage[]>([])
  const [selectedPageRow, setSelectedPageRow] = useReducer(
    (_row: SeoPageRow | null, nextRow: SeoPageRow | null) => nextRow,
    null,
  )
  const [pageFormValues, setPageFormValues] = useValueState(EMPTY_PAGE_FORM_VALUES)
  const [editingContact, setEditingContact] = useValueState<SeoContact | null>(null)
  const [contactFormValues, setContactFormValues] = useValueState<SeoContactFormValues>(EMPTY_CONTACT_FORM_VALUES)
  const [removeContactTarget, setRemoveContactTarget] = useValueState<SeoContact | null>(null)
  const [removeStorageTarget, setRemoveStorageTarget] = useValueState<OnlineShopStorage | null>(null)
  const [priorityStorageTarget, setPriorityStorageTarget] = useValueState<OnlineShopStorage | null>(null)
  const [priorityValue, setPriorityValue] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [formError, setFormError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isClientsLoading, setClientsLoading] = useValueState(true)
  const [isCardsLoading, setCardsLoading] = useValueState(true)
  const [isStoragesLoading, setStoragesLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isImageUploading, setImageUploading] = useValueState(false)
  const [isPageEditorOpen, setPageEditorOpen] = useValueState(false)
  const [isContactEditorOpen, setContactEditorOpen] = useValueState(false)
  const [isStorageDrawerOpen, setStorageDrawerOpen] = useValueState(false)
  const [reloadKey, reload] = useReducer((key: number) => key + 1, 0)

  const pageRows = useMemo(
    () => filterPageRows(getAllPageRows(settings), pageSearchValue),
    [pageSearchValue, settings],
  )
  const contacts = useMemo(
    () => filterContacts(getUniqueContacts(settings), contactSearchValue),
    [contactSearchValue, settings],
  )
  const clients = useMemo(
    () => filterOnlineShopClients(onlineShopClients, clientSearchValue),
    [clientSearchValue, onlineShopClients],
  )
  const cards = useMemo(
    () => filterPaymentRegisters(paymentRegisters, cardSearchValue),
    [cardSearchValue, paymentRegisters],
  )
  const activeStorages = useMemo(
    () => filterStorages(ecommerceStorages, storageSearchValue),
    [ecommerceStorages, storageSearchValue],
  )
  const availableStorages = useMemo(
    () => filterStorages(markEcommerceStorages(allStorages, ecommerceStorages), allStorageSearchValue),
    [allStorageSearchValue, allStorages, ecommerceStorages],
  )

  const openPageEditor = useCallback((row: SeoPageRow) => {
    setSelectedPageRow(row)
    setPageFormValues(pageToFormValues(row.page))
    setFormError(null)
    setPageEditorOpen(true)
  }, [setFormError, setPageEditorOpen, setPageFormValues])

  const openContactEditor = useCallback((contact?: SeoContact) => {
    setEditingContact(contact || null)
    setContactFormValues(contactToFormValues(contact))
    setFormError(null)
    setContactEditorOpen(true)
  }, [setContactEditorOpen, setContactFormValues, setEditingContact, setFormError])

  const requestRemoveContact = useCallback((contact: SeoContact) => {
    setRemoveContactTarget(contact)
    setContactEditorOpen(false)
    setFormError(null)
  }, [setContactEditorOpen, setFormError, setRemoveContactTarget])

  const openPriorityEditor = useCallback((storage: OnlineShopStorage) => {
    setPriorityStorageTarget(storage)
    setPriorityValue(String(storage.RetailPriority ?? ''))
    setFormError(null)
  }, [setFormError, setPriorityStorageTarget, setPriorityValue])

  const requestRemoveStorage = useCallback((storage: OnlineShopStorage) => {
    setRemoveStorageTarget(storage)
    setFormError(null)
  }, [setFormError, setRemoveStorageTarget])

  const pageColumns = useMemo<DataTableColumn<SeoPageRow>[]>(
    () => [
      {
        id: 'locale',
        header: 'Мова',
        width: 96,
        minWidth: 84,
        accessor: (row) => row.locale,
        cell: (row) => (
          <Badge color="violet" variant="light">
            {getLocaleLabel(row.locale)}
          </Badge>
        ),
      },
      {
        id: 'page',
        header: 'Сторінка',
        width: 220,
        minWidth: 180,
        accessor: (row) => getPageTitle(row.page),
        cell: (row) => (
          <Text fw={600}>{displayValue(getPageTitle(row.page))}</Text>
        ),
      },
      {
        id: 'title',
        header: 'Title',
        width: 260,
        minWidth: 220,
        accessor: (row) => row.page.Title,
        cell: (row) => shortText(row.page.Title, 120),
      },
      {
        id: 'url',
        header: 'URL',
        width: 220,
        minWidth: 180,
        accessor: (row) => row.page.Url,
        cell: (row) => displayValue(row.page.Url),
      },
      {
        id: 'description',
        header: 'Description',
        width: 360,
        minWidth: 260,
        accessor: (row) => row.page.Description,
        cell: (row) => shortText(row.page.Description, 160),
      },
      {
        id: 'updated',
        header: 'Оновлено',
        width: 152,
        minWidth: 132,
        accessor: (row) => formatDateTime(row.page.Updated),
        cell: (row) => displayValue(formatDateTime(row.page.Updated)),
      },
      {
        id: 'actions',
        header: '',
        width: 58,
        minWidth: 58,
        maxWidth: 58,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (row) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon aria-label={t('Редагувати')} color="gray" variant="subtle" onClick={() => openPageEditor(row)}>
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [openPageEditor, t],
  )

  const contactColumns = useMemo<DataTableColumn<SeoContact>[]>(
    () => [
      {
        id: 'contact',
        header: 'Контакт',
        width: 260,
        minWidth: 220,
        accessor: (contact) => contact.Name,
        cell: (contact) => (
          <Group gap="sm" wrap="nowrap">
            <Avatar color="violet" name={contact.Name || undefined} radius="xl" src={contact.ImgUrl || undefined}>
              {getContactInitials(contact)}
            </Avatar>
            <Box>
              <Text fw={600}>{displayValue(contact.Name)}</Text>
            </Box>
          </Group>
        ),
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 180,
        minWidth: 150,
        accessor: (contact) => contact.Phone,
        cell: (contact) => displayValue(contact.Phone),
      },
      {
        id: 'email',
        header: 'E-mail',
        width: 240,
        minWidth: 190,
        accessor: (contact) => contact.Email,
        cell: (contact) => displayValue(contact.Email),
      },
      {
        id: 'skype',
        header: 'Skype',
        width: 160,
        minWidth: 130,
        accessor: (contact) => contact.Skype,
        cell: (contact) => displayValue(contact.Skype),
      },
      {
        id: 'icq',
        header: 'ICQ',
        width: 140,
        minWidth: 110,
        accessor: (contact) => contact.Icq,
        cell: (contact) => displayValue(contact.Icq),
      },
      {
        id: 'updated',
        header: 'Оновлено',
        width: 152,
        minWidth: 132,
        accessor: (contact) => formatDateTime(contact.Updated),
        cell: (contact) => displayValue(formatDateTime(contact.Updated)),
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
        cell: (contact) => (
          <Group gap={4} justify="center" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color="gray"
                variant="subtle"
                onClick={() => openContactEditor(contact)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити')}>
              <ActionIcon
                aria-label={t('Видалити')}
                color="red"
                disabled={!contact.NetUid}
                variant="subtle"
                onClick={() => requestRemoveContact(contact)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [openContactEditor, requestRemoveContact, t],
  )

  const clientColumns: DataTableColumn<OnlineShopClient>[] = [
      {
        id: 'status',
        header: 'Статус',
        width: 132,
        minWidth: 118,
        accessor: (client) => Boolean(client.IsForRetail),
        cell: (client) => <StatusBadge active={Boolean(client.IsForRetail)} activeLabel="Активний" inactiveLabel="Не активний" />,
      },
      {
        id: 'client',
        header: 'Клієнт',
        width: 280,
        minWidth: 220,
        accessor: (client) => getClientDisplayName(client),
        cell: (client) => (
          <Text fw={600}>{displayValue(getClientDisplayName(client))}</Text>
        ),
      },
      {
        id: 'clientNumber',
        header: 'Номер',
        width: 140,
        minWidth: 110,
        accessor: (client) => client.ClientNumber,
        cell: (client) => displayValue(client.ClientNumber),
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 180,
        minWidth: 150,
        accessor: (client) => getClientPhone(client),
        cell: (client) => displayValue(getClientPhone(client)),
      },
      {
        id: 'email',
        header: 'E-mail',
        width: 240,
        minWidth: 190,
        accessor: (client) => client.EmailAddress,
        cell: (client) => displayValue(client.EmailAddress),
      },
      {
        id: 'clientActive',
        header: 'Активність',
        width: 128,
        minWidth: 118,
        accessor: (client) => Boolean(client.IsActive),
        cell: (client) => <StatusBadge active={Boolean(client.IsActive)} activeLabel="Активний" inactiveLabel="Не активний" />,
      },
      {
        id: 'actions',
        header: '',
        width: 70,
        minWidth: 70,
        maxWidth: 70,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (client) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={client.IsForRetail ? t('Вимкнути') : t('Увімкнути')}>
              <ActionIcon
                aria-label={client.IsForRetail ? t('Вимкнути') : t('Увімкнути')}
                color={client.IsForRetail ? 'red' : 'green'}
                disabled={!client.NetUid || isSaving}
                variant="subtle"
                onClick={() => void handleToggleOnlineShopClient(client)}
              >
                {client.IsForRetail ? <IconX size={18} /> : <IconCheck size={18} />}
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
  ]

  const paymentRegisterColumns: DataTableColumn<OnlineShopPaymentRegister>[] = [
      {
        id: 'status',
        header: 'Статус',
        width: 128,
        minWidth: 116,
        accessor: (register) => Boolean(register.IsSelected),
        cell: (register) => <StatusBadge active={Boolean(register.IsSelected)} activeLabel="Активна" inactiveLabel="Не активна" />,
      },
      {
        id: 'accountNumber',
        header: 'Рахунок',
        width: 180,
        minWidth: 150,
        accessor: (register) => register.AccountNumber || register.IBAN,
        cell: (register) => displayValue(register.AccountNumber || register.IBAN),
      },
      {
        id: 'currency',
        header: 'Валюта',
        width: 112,
        minWidth: 92,
        accessor: (register) => getPaymentRegisterCurrency(register),
        cell: (register) => displayValue(getPaymentRegisterCurrency(register)),
      },
      {
        id: 'name',
        header: 'Назва',
        width: 240,
        minWidth: 190,
        accessor: (register) => register.Name,
        cell: (register) => displayValue(register.Name),
      },
      {
        id: 'bankName',
        header: 'Банк',
        width: 220,
        minWidth: 180,
        accessor: (register) => register.BankName,
        cell: (register) => displayValue(register.BankName),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 280,
        minWidth: 220,
        accessor: (register) => getOrganizationName(register.Organization),
        cell: (register) => displayValue(getOrganizationName(register.Organization)),
      },
      {
        id: 'registerActive',
        header: 'Активність',
        width: 128,
        minWidth: 118,
        accessor: (register) => Boolean(register.IsActive),
        cell: (register) => <StatusBadge active={Boolean(register.IsActive)} activeLabel="Активна" inactiveLabel="Не активна" />,
      },
      {
        id: 'actions',
        header: '',
        width: 70,
        minWidth: 70,
        maxWidth: 70,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (register) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Обрати')}>
              <ActionIcon
                aria-label={t('Обрати')}
                color={register.IsSelected ? 'green' : 'gray'}
                disabled={!register.NetUid || isSaving}
                variant="subtle"
                onClick={() => void handleSelectPaymentRegister(register)}
              >
                <IconCheck size={18} />
              </ActionIcon>
            </Tooltip>
          </Box>
        ),
      },
  ]

  const ecommerceStorageColumns = useMemo<DataTableColumn<OnlineShopStorage>[]>(
    () => [
      {
        id: 'priority',
        header: 'Пріоритет',
        width: 112,
        minWidth: 100,
        accessor: (storage) => Number(storage.RetailPriority || 0),
        cell: (storage) => (
          <Badge color="violet" variant="light">
            {displayValue(storage.RetailPriority)}
          </Badge>
        ),
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 280,
        minWidth: 220,
        accessor: (storage) => storage.Name,
        cell: (storage) => (
          <Text fw={600}>{displayValue(storage.Name)}</Text>
        ),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 280,
        minWidth: 220,
        accessor: (storage) => getOrganizationName(storage.Organization),
        cell: (storage) => displayValue(getOrganizationName(storage.Organization)),
      },
      {
        id: 'locale',
        header: 'Мова',
        width: 96,
        minWidth: 84,
        accessor: (storage) => storage.Locale,
        cell: (storage) => displayValue(storage.Locale),
      },
      {
        id: 'status',
        header: 'Статус',
        width: 126,
        minWidth: 112,
        accessor: (storage) => Boolean(storage.ForEcommerce),
        cell: (storage) => <StatusBadge active={Boolean(storage.ForEcommerce)} activeLabel="Активний" inactiveLabel="Не активний" />,
      },
      {
        id: 'actions',
        header: '',
        width: 104,
        minWidth: 104,
        maxWidth: 104,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (storage) => (
          <Group gap={4} justify="center" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
            <Tooltip label={t('Змінити пріоритет')}>
              <ActionIcon
                aria-label={t('Змінити пріоритет')}
                color="gray"
                disabled={!storage.Id || isSaving}
                variant="subtle"
                onClick={() => openPriorityEditor(storage)}
              >
                <IconPencil size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('Видалити зі списку')}>
              <ActionIcon
                aria-label={t('Видалити зі списку')}
                color="red"
                disabled={!storage.NetUid || isSaving}
                variant="subtle"
                onClick={() => requestRemoveStorage(storage)}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [isSaving, openPriorityEditor, requestRemoveStorage, t],
  )

  const allStorageColumns: DataTableColumn<OnlineShopStorage>[] = [
      {
        id: 'status',
        header: 'Статус',
        width: 126,
        minWidth: 112,
        accessor: (storage) => isStorageActive(storage, ecommerceStorages),
        cell: (storage) => (
          <StatusBadge
            active={isStorageActive(storage, ecommerceStorages)}
            activeLabel="Активний"
            inactiveLabel="Не активний"
          />
        ),
      },
      {
        id: 'storage',
        header: 'Склад',
        width: 280,
        minWidth: 220,
        accessor: (storage) => storage.Name,
        cell: (storage) => (
          <Text fw={600}>{displayValue(storage.Name)}</Text>
        ),
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 280,
        minWidth: 220,
        accessor: (storage) => getOrganizationName(storage.Organization),
        cell: (storage) => displayValue(getOrganizationName(storage.Organization)),
      },
      {
        id: 'locale',
        header: 'Мова',
        width: 96,
        minWidth: 84,
        accessor: (storage) => storage.Locale,
        cell: (storage) => displayValue(storage.Locale),
      },
      {
        id: 'priority',
        header: 'Пріоритет',
        width: 112,
        minWidth: 100,
        accessor: (storage) => Number(storage.RetailPriority || 0),
        cell: (storage) => displayValue(storage.RetailPriority),
      },
      {
        id: 'actions',
        header: '',
        width: 88,
        minWidth: 88,
        maxWidth: 88,
        align: 'center',
        enableHiding: false,
        enableReorder: false,
        enableResizing: false,
        enableSorting: false,
        cell: (storage) => {
          const active = isStorageActive(storage, ecommerceStorages)

          return (
            <Box onClick={(event) => event.stopPropagation()}>
              <Tooltip label={active ? t('Вже додано') : t('Додати')}>
                <ActionIcon
                  aria-label={active ? t('Вже додано') : t('Додати')}
                  color={active ? 'green' : 'gray'}
                  disabled={active || !storage.NetUid || isSaving}
                  variant="subtle"
                  onClick={() => void handleAddStorage(storage)}
                >
                  <IconPlus size={18} />
                </ActionIcon>
              </Tooltip>
            </Box>
          )
        },
      },
  ]

  const pagesToolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {pageSearchValue ? `${t('пошук')}: ${pageSearchValue}` : ''}
      </Text>
    ),
    [pageSearchValue, t],
  )

  const contactsToolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {contactSearchValue ? `${t('пошук')}: ${contactSearchValue}` : ''}
      </Text>
    ),
    [contactSearchValue, t],
  )

  const clientsToolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {clientSearchValue ? `${t('пошук')}: ${clientSearchValue}` : ''}
      </Text>
    ),
    [clientSearchValue, t],
  )

  const cardsToolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {cardSearchValue ? `${t('пошук')}: ${cardSearchValue}` : ''}
      </Text>
    ),
    [cardSearchValue, t],
  )

  const storagesToolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {storageSearchValue ? `${t('пошук')}: ${storageSearchValue}` : ''}
      </Text>
    ),
    [storageSearchValue, t],
  )

  const allStoragesToolbarLeft = useMemo(
    () => (
      <Text size="xs" c="dimmed">
        {allStorageSearchValue ? `${t('пошук')}: ${allStorageSearchValue}` : ''}
      </Text>
    ),
    [allStorageSearchValue, t],
  )

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)
      setError(null)

      try {
        const nextSettings = await getOnlineShopSeoSettings()

        if (!cancelled) {
          setSettings(nextSettings)
        }
      } catch (loadError) {
        if (!cancelled) {
          setSettings([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити SEO онлайн-магазину'))
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
  }, [reloadKey, setError, setLoading, setSettings, t])

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      setClientsLoading(true)

      try {
        const nextClients = await getOnlineShopClients()

        if (!cancelled) {
          setOnlineShopClients(nextClients)
        }
      } catch (loadError) {
        if (!cancelled) {
          setOnlineShopClients([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити інтернет клієнтів'))
        }
      } finally {
        if (!cancelled) {
          setClientsLoading(false)
        }
      }
    }

    void loadClients()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setClientsLoading, setError, setOnlineShopClients, t])

  useEffect(() => {
    let cancelled = false

    async function loadCards() {
      setCardsLoading(true)

      try {
        const nextCards = await getOnlineShopPaymentRegisters()

        if (!cancelled) {
          setPaymentRegisters(nextCards)
        }
      } catch (loadError) {
        if (!cancelled) {
          setPaymentRegisters([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити банківські картки'))
        }
      } finally {
        if (!cancelled) {
          setCardsLoading(false)
        }
      }
    }

    void loadCards()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setCardsLoading, setError, setPaymentRegisters, t])

  useEffect(() => {
    let cancelled = false

    async function loadStorages() {
      setStoragesLoading(true)

      try {
        const [nextActiveStorages, nextAllStorages] = await Promise.all([getEcommerceStorages(), getAllOnlineShopStorages()])

        if (!cancelled) {
          setEcommerceStorages(sortStoragesByPriority(nextActiveStorages))
          setAllStorages(markEcommerceStorages(nextAllStorages, nextActiveStorages))
        }
      } catch (loadError) {
        if (!cancelled) {
          setEcommerceStorages([])
          setAllStorages([])
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити склади'))
        }
      } finally {
        if (!cancelled) {
          setStoragesLoading(false)
        }
      }
    }

    void loadStorages()

    return () => {
      cancelled = true
    }
  }, [reloadKey, setAllStorages, setEcommerceStorages, setError, setStoragesLoading, t])

  function changePageSearch(value: string) {
    setPageSearchDraft(value)
    setPageSearchValue(value.trim())
  }

  function changeContactSearch(value: string) {
    setContactSearchDraft(value)
    setContactSearchValue(value.trim())
  }

  function changeClientSearch(value: string) {
    setClientSearchDraft(value)
    setClientSearchValue(value.trim())
  }

  function changeCardSearch(value: string) {
    setCardSearchDraft(value)
    setCardSearchValue(value.trim())
  }

  function changeStorageSearch(value: string) {
    setStorageSearchDraft(value)
    setStorageSearchValue(value.trim())
  }

  function changeAllStorageSearch(value: string) {
    setAllStorageSearchDraft(value)
    setAllStorageSearchValue(value.trim())
  }

  function resetPageSearch() {
    setPageSearchDraft('')
    setPageSearchValue('')
  }

  function resetContactSearch() {
    setContactSearchDraft('')
    setContactSearchValue('')
  }

  function resetClientSearch() {
    setClientSearchDraft('')
    setClientSearchValue('')
  }

  function resetCardSearch() {
    setCardSearchDraft('')
    setCardSearchValue('')
  }

  function resetStorageSearch() {
    setStorageSearchDraft('')
    setStorageSearchValue('')
  }

  function resetAllStorageSearch() {
    setAllStorageSearchDraft('')
    setAllStorageSearchValue('')
  }

  function closePageEditor() {
    if (isSaving) {
      return
    }

    setPageEditorOpen(false)
    setSelectedPageRow(null)
    setPageFormValues(EMPTY_PAGE_FORM_VALUES)
    setFormError(null)
  }

  function closeContactEditor() {
    if (isSaving || isImageUploading) {
      return
    }

    setContactEditorOpen(false)
    setEditingContact(null)
    setContactFormValues(EMPTY_CONTACT_FORM_VALUES)
    setFormError(null)
  }

  function closePriorityEditor() {
    if (isSaving) {
      return
    }

    setPriorityStorageTarget(null)
    setPriorityValue('')
    setFormError(null)
  }

  function setPageField<K extends keyof typeof pageFormValues>(key: K, value: (typeof pageFormValues)[K]) {
    setPageFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  function setContactField<K extends keyof SeoContactFormValues>(key: K, value: SeoContactFormValues[K]) {
    setContactFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }))
  }

  async function handleSavePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedPageRow) {
      return
    }

    const validationError = validatePage(pageFormValues)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextSettings = await updateSeoPage({
        ...selectedPageRow.page,
        ...pageFormValues,
        Locale: selectedPageRow.page.Locale || selectedPageRow.locale,
      })

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('SEO сторінки оновлено') })
      closePageEditor()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти SEO сторінки'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveContactInfo(locale: string, contactInfo: SeoContactInfo | null, values: SeoContactInfoFormValues) {
    setSaving(true)
    setError(null)

    try {
      const nextSettings = await updateSeoContactInfo({
        ...(contactInfo || {}),
        ...values,
        Locale: contactInfo?.Locale || locale,
      })

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('Контактну інформацію оновлено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти контактну інформацію'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePayment(locale: string, payment: SeoRetailPaymentInfo | null, values: SeoPaymentFormValues) {
    if (!hasPaymentRecord(payment)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextSettings = await updateSeoPaymentInfo({
        ...(payment || {}),
        ...values,
        CultureCode: payment?.CultureCode || locale,
      })

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('Інформацію про оплату оновлено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти інформацію про оплату'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateContact(contactFormValues)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const payload = {
        ...(editingContact || {}),
        ...contactFormValues,
      }
      const nextSettings = editingContact ? await updateSeoContact(payload) : await createSeoContact(payload)

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: editingContact ? t('Контакт оновлено') : t('Контакт створено') })
      closeContactEditor()
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти контакт'))
    } finally {
      setSaving(false)
    }
  }

  async function handleContactImageChange(file: File | null) {
    if (!file) {
      return
    }

    setImageUploading(true)
    setFormError(null)

    try {
      const imageUrl = await uploadSeoContactImage(file)

      if (!imageUrl) {
        throw new Error(t('Сервер не повернув посилання на фото'))
      }

      setContactField('ImgUrl', imageUrl)
      notifications.show({ color: 'green', message: t('Фото контакту завантажено') })
    } catch (uploadError) {
      setFormError(uploadError instanceof Error ? uploadError.message : t('Не вдалося завантажити фото контакту'))
    } finally {
      setImageUploading(false)
    }
  }

  async function handleRemoveContact() {
    if (!removeContactTarget?.NetUid) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextSettings = await removeSeoContact(removeContactTarget.NetUid)

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('Контакт видалено') })
      setRemoveContactTarget(null)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('Не вдалося видалити контакт'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleOnlineShopClient(client: OnlineShopClient) {
    if (!client.NetUid || isSaving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextClients = await toggleOnlineShopClient(client.NetUid)

      setOnlineShopClients(nextClients)
      notifications.show({ color: 'green', message: client.IsForRetail ? t('Клієнта вимкнено') : t('Клієнта увімкнено') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося змінити статус клієнта'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSelectPaymentRegister(register: OnlineShopPaymentRegister) {
    if (!register.NetUid || isSaving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextRegisters = await selectOnlineShopPaymentRegister(register.NetUid)

      setPaymentRegisters(nextRegisters)
      notifications.show({ color: 'green', message: t('Банківську картку обрано') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося обрати банківську картку'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddStorage(storage: OnlineShopStorage) {
    if (!storage.NetUid || isSaving || isStorageActive(storage, ecommerceStorages)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextStorages = sortStoragesByPriority(await addEcommerceStorage(storage.NetUid))

      setEcommerceStorages(nextStorages)
      setAllStorages((currentStorages) => markEcommerceStorages(currentStorages, nextStorages))
      notifications.show({ color: 'green', message: t('Склад додано') })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося додати склад'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveStorage() {
    if (!removeStorageTarget?.NetUid || isSaving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextStorages = sortStoragesByPriority(await removeEcommerceStorage(removeStorageTarget.NetUid))

      setEcommerceStorages(nextStorages)
      setAllStorages((currentStorages) => markEcommerceStorages(currentStorages, nextStorages))
      setRemoveStorageTarget(null)
      notifications.show({ color: 'green', message: t('Склад видалено зі списку') })
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('Не вдалося видалити склад зі списку'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveStoragePriority(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!priorityStorageTarget?.Id || isSaving) {
      return
    }

    const validationError = validateStoragePriority(priorityValue, priorityStorageTarget, ecommerceStorages)

    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextStorages = sortStoragesByPriority(
        await updateEcommerceStoragePriority(priorityStorageTarget.Id, Number(priorityValue)),
      )

      setEcommerceStorages(nextStorages)
      setAllStorages((currentStorages) => markEcommerceStorages(currentStorages, nextStorages))
      setPriorityStorageTarget(null)
      setPriorityValue('')
      notifications.show({ color: 'green', message: t('Пріоритет складу оновлено') })
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося оновити пріоритет складу'))
    } finally {
      setSaving(false)
    }
  }

  return {
    t, activeStorages, activeTab, allStorageColumns, allStorageSearchDraft, allStoragesToolbarLeft,
    availableStorages, cardSearchDraft, cards, cardsToolbarLeft, clientColumns, clientSearchDraft, clients,
    clientsToolbarLeft, contactColumns, contactFormValues, contactSearchDraft, contacts, contactsToolbarLeft,
    ecommerceStorageColumns, ecommerceStorages, editingContact, error, formError, isCardsLoading,
    isClientsLoading, isContactEditorOpen, isImageUploading, isLoading, isPageEditorOpen, isSaving,
    isStorageDrawerOpen, isStoragesLoading, pageColumns, pageFormValues, pageRows, pageSearchDraft,
    pagesToolbarLeft, paymentRegisterColumns, priorityStorageTarget, priorityValue, removeContactTarget,
    removeStorageTarget, settings, storageSearchDraft, storagesToolbarLeft, allStorageSearchValue,
    cardSearchValue, clientSearchValue, contactSearchValue, pageSearchValue, storageSearchValue,
    changeAllStorageSearch, changeCardSearch, changeClientSearch, changeContactSearch, changePageSearch,
    changeStorageSearch, closeContactEditor, closePageEditor, closePriorityEditor, handleAddStorage, handleContactImageChange,
    handleRemoveContact, handleRemoveStorage, handleSaveContact, handleSaveContactInfo, handleSavePage,
    handleSavePayment, handleSaveStoragePriority, handleSelectPaymentRegister, handleToggleOnlineShopClient,
    openContactEditor, openPageEditor, reload, resetAllStorageSearch, resetCardSearch, resetClientSearch,
    resetContactSearch, resetPageSearch, resetStorageSearch, setActiveTab, setContactField, setFormError,
    setPageField, setPriorityValue, setRemoveContactTarget, setRemoveStorageTarget, setStorageDrawerOpen,
  }
}

export function OnlineShopSeoPage() {
  const model = useOnlineShopSeoPageModel()

  return renderOnlineShopSeoPage(model)
}

function renderOnlineShopSeoPage(model: ReturnType<typeof useOnlineShopSeoPageModel>) {
  const {
    t, activeStorages, activeTab, allStorageColumns, allStorageSearchDraft, allStoragesToolbarLeft,
    availableStorages, cardSearchDraft, cards, cardsToolbarLeft, clientColumns, clientSearchDraft, clients,
    clientsToolbarLeft, contactColumns, contactFormValues, contactSearchDraft, contacts, contactsToolbarLeft,
    ecommerceStorageColumns, ecommerceStorages, editingContact, error, formError, isCardsLoading,
    isClientsLoading, isContactEditorOpen, isImageUploading, isLoading, isPageEditorOpen, isSaving,
    isStorageDrawerOpen, isStoragesLoading, pageColumns, pageFormValues, pageRows, pageSearchDraft,
    pagesToolbarLeft, paymentRegisterColumns, priorityStorageTarget, priorityValue, removeContactTarget,
    removeStorageTarget, settings, storageSearchDraft, storagesToolbarLeft, closeContactEditor, closePageEditor,
    closePriorityEditor, handleAddStorage, handleContactImageChange, handleRemoveContact, handleRemoveStorage,
    handleSaveContact, handleSaveContactInfo, handleSavePage, handleSavePayment, handleSaveStoragePriority,
    handleSelectPaymentRegister, handleToggleOnlineShopClient, changeAllStorageSearch, changeCardSearch,
    changeClientSearch, changeContactSearch, changePageSearch, changeStorageSearch, openContactEditor, openPageEditor, reload,
    resetAllStorageSearch, resetCardSearch, resetClientSearch, resetContactSearch, resetPageSearch,
    resetStorageSearch, setActiveTab, setContactField, setFormError, setPageField, setPriorityValue,
    setRemoveContactTarget, setRemoveStorageTarget, setStorageDrawerOpen,
  } = model

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Group justify="space-between" gap="sm" wrap="nowrap">
            <div className="pill-tabs">
              {SEO_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`pill-tab${activeTab === tab.value ? ' is-active' : ''}`}
                  aria-pressed={activeTab === tab.value}
                  onClick={() => setActiveTab(tab.value)}
                >
                  {t(tab.label)}
                </button>
              ))}
            </div>
            <Tooltip label={t('Оновити')}>
              <ActionIcon
                aria-label={t('Оновити')}
                color="gray"
                loading={isLoading}
                size={36}
                variant="light"
                onClick={() => reload()}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <Box>
            {activeTab === 'pages' && (
              <Box pt="md">
              <Stack gap="md">
                <SearchToolbar
                  placeholder={t('Назва, URL або текст')}
                  value={pageSearchDraft}
                  onChange={changePageSearch}
                  onReset={resetPageSearch}
                />

                <DataTable
                  columns={pageColumns}
                  data={pageRows}
                  defaultLayout={SEO_PAGES_TABLE_DEFAULT_LAYOUT}
                  emptyText={t('Сторінок не знайдено')}
                  getRowId={(row, index) => `${row.locale}-${row.page.NetUid || row.page.Id || index}`}
                  isLoading={isLoading}
                  layoutVersion="online-shop-seo-pages-table-1"
                  loadingText={t('Завантаження сторінок')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1260}
                  tableId="online-shop-seo-pages"
                  toolbarLeft={pagesToolbarLeft}
                  onRowClick={openPageEditor}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'contact-info' && (
              <Box pt="md">
              <LocaleAccordion entries={settings} emptyText={t('Контактної інформації не знайдено')}>
                {(entry) => (
                  <ContactInfoForm
                    key={`${entry.locale}-${entry.settings.EcommerceContactInfo?.NetUid || 'new'}`}
                    contactInfo={entry.settings.EcommerceContactInfo || null}
                    isSaving={isSaving}
                    locale={entry.locale}
                    onSave={handleSaveContactInfo}
                  />
                )}
              </LocaleAccordion>
              </Box>
            )}

            {activeTab === 'contacts' && (
              <Box pt="md">
              <Stack gap="md">
                <SearchToolbar
                  action={(
                    <Button
                      color="violet"
                      leftSection={<IconPlus size={16} />}
                      type="button"
                      onClick={() => openContactEditor()}
                      style={{ flex: '0 0 auto' }}
                    >
                      {t('Новий контакт')}
                    </Button>
                  )}
                  placeholder={t('Імʼя, телефон або e-mail')}
                  value={contactSearchDraft}
                  onChange={changeContactSearch}
                  onReset={resetContactSearch}
                />

                <DataTable
                  columns={contactColumns}
                  data={contacts}
                  defaultLayout={SEO_CONTACTS_TABLE_DEFAULT_LAYOUT}
                  emptyText={t('Контактів не знайдено')}
                  getRowId={(contact, index) => String(contact.NetUid || contact.Id || index)}
                  isLoading={isLoading}
                  layoutVersion="online-shop-seo-contacts-table-1"
                  loadingText={t('Завантаження контактів')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1220}
                  tableId="online-shop-seo-contacts"
                  toolbarLeft={contactsToolbarLeft}
                  onRowClick={openContactEditor}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'payment' && (
              <Box pt="md">
              <LocaleAccordion entries={settings} emptyText={t('Інформації про оплату не знайдено')}>
                {(entry) => (
                  <PaymentInfoForm
                    key={`${entry.locale}-${entry.settings.RetailPaymentTypeTranslate?.NetUid || 'new'}`}
                    isSaving={isSaving}
                    locale={entry.locale}
                    payment={entry.settings.RetailPaymentTypeTranslate || null}
                    onSave={handleSavePayment}
                  />
                )}
              </LocaleAccordion>
              </Box>
            )}

            {activeTab === 'shop-clients' && (
              <Box pt="md">
              <Stack gap="md">
                <SearchToolbar
                  placeholder={t('Назва, телефон або e-mail')}
                  value={clientSearchDraft}
                  onChange={changeClientSearch}
                  onReset={resetClientSearch}
                />

                <DataTable
                  columns={clientColumns}
                  data={clients}
                  defaultLayout={ONLINE_SHOP_CLIENTS_TABLE_DEFAULT_LAYOUT}
                  emptyText={t('Клієнтів не знайдено')}
                  getRowId={(client, index) => String(client.NetUid || client.Id || index)}
                  isLoading={isClientsLoading}
                  layoutVersion="online-shop-seo-clients-table-1"
                  loadingText={t('Завантаження клієнтів')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1170}
                  tableId="online-shop-seo-clients"
                  toolbarLeft={clientsToolbarLeft}
                  onRowClick={(client) => void handleToggleOnlineShopClient(client)}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'bank-cards' && (
              <Box pt="md">
              <Stack gap="md">
                <SearchToolbar
                  placeholder={t('Рахунок, назва, банк або організація')}
                  value={cardSearchDraft}
                  onChange={changeCardSearch}
                  onReset={resetCardSearch}
                />

                <DataTable
                  columns={paymentRegisterColumns}
                  data={cards}
                  defaultLayout={PAYMENT_REGISTERS_TABLE_DEFAULT_LAYOUT}
                  emptyText={t('Банківських карток не знайдено')}
                  getRowId={(register, index) => String(register.NetUid || register.Id || index)}
                  isLoading={isCardsLoading}
                  layoutVersion="online-shop-seo-payment-registers-table-1"
                  loadingText={t('Завантаження карток')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1370}
                  tableId="online-shop-seo-payment-registers"
                  toolbarLeft={cardsToolbarLeft}
                  onRowClick={(register) => void handleSelectPaymentRegister(register)}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'warehouses' && (
              <Box pt="md">
              <Stack gap="md">
                <SearchToolbar
                  action={(
                    <Button
                      color="violet"
                      leftSection={<IconPlus size={16} />}
                      type="button"
                      onClick={() => setStorageDrawerOpen(true)}
                      style={{ flex: '0 0 auto' }}
                    >
                      {t('Додати склад')}
                    </Button>
                  )}
                  placeholder={t('Назва або організація')}
                  value={storageSearchDraft}
                  onChange={changeStorageSearch}
                  onReset={resetStorageSearch}
                />

                <DataTable
                  columns={ecommerceStorageColumns}
                  data={activeStorages}
                  defaultLayout={ECOMMERCE_STORAGES_TABLE_DEFAULT_LAYOUT}
                  emptyText={t('Активних складів не знайдено')}
                  getRowId={(storage, index) => String(storage.NetUid || storage.Id || index)}
                  isLoading={isStoragesLoading}
                  layoutVersion="online-shop-seo-ecommerce-storages-table-1"
                  loadingText={t('Завантаження складів')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1000}
                  tableId="online-shop-seo-ecommerce-storages"
                  toolbarLeft={storagesToolbarLeft}
                />
              </Stack>
              </Box>
            )}
          </Box>
        </Stack>
      </Card>

      <AppModal centered opened={isPageEditorOpen} size="xl" title={t('Редагування SEO сторінки')} onClose={closePageEditor}>
        <form onSubmit={handleSavePage}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label="Page name"
                value={pageFormValues.PageName}
                onChange={(event) => setPageField('PageName', event.currentTarget.value)}
              />
              <TextInput
                label="URL"
                value={pageFormValues.Url}
                onChange={(event) => setPageField('Url', event.currentTarget.value)}
              />
            </SimpleGrid>
            <TextInput
              label="Title"
              value={pageFormValues.Title}
              onChange={(event) => setPageField('Title', event.currentTarget.value)}
            />
            <Textarea
              autosize
              label="Description"
              minRows={3}
              value={pageFormValues.Description}
              onChange={(event) => setPageField('Description', event.currentTarget.value)}
            />
            <Textarea
              autosize
              label="Keywords"
              minRows={3}
              value={pageFormValues.KeyWords}
              onChange={(event) => setPageField('KeyWords', event.currentTarget.value)}
            />
            <Textarea
              autosize
              label="LD JSON"
              minRows={6}
              value={pageFormValues.LdJson}
              onChange={(event) => setPageField('LdJson', event.currentTarget.value)}
            />
            <Group justify="flex-end" gap="sm">
              <Button color="gray" disabled={isSaving} type="button" variant="light" onClick={closePageEditor}>
                {t('Скасувати')}
              </Button>
              <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
                {t('Зберегти')}
              </Button>
            </Group>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        centered
        opened={isContactEditorOpen}
        title={editingContact ? t('Редагування контакту') : t('Новий контакт')}
        onClose={closeContactEditor}
      >
        <form onSubmit={handleSaveContact}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <TextInput
              label={t('Імʼя')}
              value={contactFormValues.Name}
              onChange={(event) => setContactField('Name', event.currentTarget.value)}
            />
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <Avatar color="violet" name={contactFormValues.Name || undefined} radius="md" size={72} src={contactFormValues.ImgUrl || undefined}>
                {getContactInitials({ Name: contactFormValues.Name })}
              </Avatar>
              <FileInput
                accept="image/*"
                clearable
                disabled={isSaving || isImageUploading}
                label={t('Фото')}
                leftSection={<IconPhoto size={16} />}
                placeholder={t('Обрати файл')}
                style={{ flex: '1 1 auto' }}
                onChange={handleContactImageChange}
              />
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label={t('Телефон')}
                value={contactFormValues.Phone}
                onChange={(event) => setContactField('Phone', event.currentTarget.value)}
              />
              <TextInput
                label="E-mail"
                value={contactFormValues.Email}
                onChange={(event) => setContactField('Email', event.currentTarget.value)}
              />
              <TextInput
                label="Skype"
                value={contactFormValues.Skype}
                onChange={(event) => setContactField('Skype', event.currentTarget.value)}
              />
              <TextInput
                label="ICQ"
                value={contactFormValues.Icq}
                onChange={(event) => setContactField('Icq', event.currentTarget.value)}
              />
            </SimpleGrid>
            <Group justify="flex-end" gap="sm">
              <Button color="gray" disabled={isSaving || isImageUploading} type="button" variant="light" onClick={closeContactEditor}>
                {t('Скасувати')}
              </Button>
              <Button
                color="violet"
                disabled={isImageUploading}
                leftSection={<IconDeviceFloppy size={16} />}
                loading={isSaving}
                type="submit"
              >
                {t('Зберегти')}
              </Button>
            </Group>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        centered
        opened={Boolean(removeContactTarget)}
        title={t('Видалити контакт')}
        onClose={() => setRemoveContactTarget(null)}
      >
        <Stack gap="md">
          <Text>
            {t('Видалити контакт')} <Text span fw={600}>{displayValue(removeContactTarget?.Name)}</Text>?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isSaving} variant="light" onClick={() => setRemoveContactTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={handleRemoveContact}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal centered opened={Boolean(priorityStorageTarget)} title={t('Пріоритет складу')} onClose={closePriorityEditor}>
        <form onSubmit={handleSaveStoragePriority}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <TextInput
              label={displayValue(priorityStorageTarget?.Name, t('Склад'))}
              min={1}
              type="number"
              value={priorityValue}
              onChange={(event) => {
                const nextValue = event.currentTarget.value

                setPriorityValue(nextValue)
                setFormError(priorityStorageTarget ? validateStoragePriority(nextValue, priorityStorageTarget, ecommerceStorages) : null)
              }}
            />
            <Group justify="flex-end" gap="sm">
              <Button color="gray" disabled={isSaving} type="button" variant="light" onClick={closePriorityEditor}>
                {t('Скасувати')}
              </Button>
              <Button color="violet" leftSection={<IconDeviceFloppy size={16} />} loading={isSaving} type="submit">
                {t('Зберегти')}
              </Button>
            </Group>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        centered
        opened={Boolean(removeStorageTarget)}
        title={t('Видалити склад зі списку')}
        onClose={() => setRemoveStorageTarget(null)}
      >
        <Stack gap="md">
          <Text>
            {t('Видалити склад')} <Text span fw={600}>{displayValue(removeStorageTarget?.Name)}</Text> {t('зі списку інтернет-магазину?')}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isSaving} variant="light" onClick={() => setRemoveStorageTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isSaving} onClick={handleRemoveStorage}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppDrawer
        opened={isStorageDrawerOpen}
        padding="md"
        position="right"
        size="xl"
        title={t('Усі склади')}
        onClose={() => setStorageDrawerOpen(false)}
      >
        <Stack gap="md">
          <SearchToolbar
            placeholder={t('Назва або організація')}
            value={allStorageSearchDraft}
            onChange={changeAllStorageSearch}
            onReset={resetAllStorageSearch}
          />

          <DataTable
            columns={allStorageColumns}
            data={availableStorages}
            defaultLayout={ALL_STORAGES_TABLE_DEFAULT_LAYOUT}
            emptyText={t('Складів не знайдено')}
            getRowId={(storage, index) => String(storage.NetUid || storage.Id || index)}
            isLoading={isStoragesLoading}
            layoutVersion="online-shop-seo-all-storages-table-1"
            loadingText={t('Завантаження складів')}
            maxHeight="calc(100vh - 220px)"
            minWidth={980}
            tableId="online-shop-seo-all-storages"
            toolbarLeft={allStoragesToolbarLeft}
            onRowClick={(storage) => void handleAddStorage(storage)}
          />
        </Stack>
      </AppDrawer>
    </Stack>
  )
}

function filterPageRows(rows: SeoPageRow[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return rows
  }

  return rows.filter((row) =>
    [row.locale, row.page.PageName, row.page.Title, row.page.Url, row.page.Description, row.page.KeyWords]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function filterContacts(contacts: SeoContact[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return contacts
  }

  return contacts.filter((contact) =>
    [contact.Name, contact.Phone, contact.Email, contact.Skype, contact.Icq, contact.NetUid]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function shortText(value: string | undefined, maxLength: number) {
  const text = value?.trim()

  if (!text) {
    return '-'
  }

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1)}…`
}

function getContactInitials(contact: SeoContact) {
  const name = contact.Name?.trim()

  if (!name) {
    return '?'
  }

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function filterOnlineShopClients(clients: OnlineShopClient[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return clients
  }

  return clients.filter((client) =>
    [
      getClientDisplayName(client),
      getClientPhone(client),
      client.ClientNumber,
      client.EmailAddress,
      client.NetUid,
      client.IsForRetail ? translate('активний') : translate('не активний'),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function filterPaymentRegisters(registers: OnlineShopPaymentRegister[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return registers
  }

  return registers.filter((register) =>
    [
      register.AccountNumber,
      register.IBAN,
      getPaymentRegisterCurrency(register),
      register.Name,
      register.BankName,
      getOrganizationName(register.Organization),
      register.NetUid,
      register.IsSelected ? translate('активна') : translate('не активна'),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function filterStorages(storages: OnlineShopStorage[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return storages
  }

  return storages.filter((storage) =>
    [
      storage.Name,
      storage.Locale,
      storage.RetailPriority,
      getOrganizationName(storage.Organization),
      storage.NetUid,
      storage.ForEcommerce ? translate('активний') : translate('не активний'),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
  )
}

function getClientDisplayName(client: OnlineShopClient) {
  return client.Name || client.FullName || ''
}

function getClientPhone(client: OnlineShopClient) {
  return client.MobileNumber || client.SMSNumber || ''
}

function getPaymentRegisterCurrency(register: OnlineShopPaymentRegister) {
  return (
    register.DefaultPaymentCurrencyRegister?.Currency?.Code ||
    register.PaymentCurrencyRegisters?.[0]?.Currency?.Code ||
    register.DefaultPaymentCurrencyRegister?.Currency?.Name ||
    register.PaymentCurrencyRegisters?.[0]?.Currency?.Name ||
    ''
  )
}

function getOrganizationName(organization?: OnlineShopPaymentRegister['Organization'] | OnlineShopStorage['Organization']) {
  return organization?.FullName || organization?.Name || organization?.Abbreviation || ''
}

function sortStoragesByPriority(storages: OnlineShopStorage[]) {
  return storages.toSorted((firstStorage, secondStorage) => {
    const firstPriority = firstStorage.RetailPriority ?? Number.MAX_SAFE_INTEGER
    const secondPriority = secondStorage.RetailPriority ?? Number.MAX_SAFE_INTEGER

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority
    }

    return (firstStorage.Name || '').localeCompare(secondStorage.Name || '', 'uk')
  })
}

function markEcommerceStorages(storages: OnlineShopStorage[], activeStorages: OnlineShopStorage[]) {
  const activeStorageKeys = new Set<string>()
  activeStorages.forEach((storage) => {
    const key = getEntityKey(storage)

    if (key) {
      activeStorageKeys.add(key)
    }
  })

  return storages.map((storage) => ({
    ...storage,
    ForEcommerce: activeStorageKeys.has(getEntityKey(storage)),
  }))
}

function isStorageActive(storage: OnlineShopStorage, activeStorages: OnlineShopStorage[]) {
  const storageKey = getEntityKey(storage)

  return Boolean(storageKey && activeStorages.some((activeStorage) => getEntityKey(activeStorage) === storageKey))
}

function validateStoragePriority(value: string, selectedStorage: OnlineShopStorage, storages: OnlineShopStorage[]) {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return translate('Вкажіть пріоритет')
  }

  const priority = Number(trimmedValue)

  if (!Number.isInteger(priority) || priority < 1) {
    return translate('Пріоритет має бути цілим додатним числом')
  }

  const hasDuplicatePriority = storages.some((storage) => {
    const sameStorage = getEntityKey(storage) === getEntityKey(selectedStorage)

    return !sameStorage && Number(storage.RetailPriority) === priority
  })

  return hasDuplicatePriority ? translate('Пріоритет складу не може повторюватися') : null
}

function getEntityKey(entity: Pick<OnlineShopStorage | OnlineShopClient | OnlineShopPaymentRegister, 'Id' | 'NetUid'>) {
  return entity.NetUid || (typeof entity.Id === 'number' ? String(entity.Id) : '')
}
