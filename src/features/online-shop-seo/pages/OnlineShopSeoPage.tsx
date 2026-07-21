import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  FileInput,
  Group,
  ScrollArea,
  Select,
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
import { Building, Check, ChevronRight, CircleAlert, CreditCard, FileText, Hash, Image, Link, Pencil, Phone, Plus, RefreshCw, RotateCcw, Save, Search, ShoppingBasket, Trash2, X } from 'lucide-react'
import { type CSSProperties, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useReducer } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useValueState } from '../../../shared/hooks/useValueState'
import { translate } from '../../../shared/i18n/translate'
import type { TranslationKey } from '../../../shared/i18n/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { usePageBreadcrumb } from '../../../shared/ui/page-header-actions/pageHeaderActionsContext'
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
  PaymentInfoForm,
  SearchToolbar,
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
  getSeoContactDisplayName,
  getUniqueContacts,
  hasPaymentRecord,
  pageToFormValues,
  validateContact,
  validatePage,
} from '../utils'
import './online-shop-seo-page.css'
import '../../../shared/ui/console-table-page.css'

type SeoTab = 'pages' | 'info-payment' | 'contacts' | 'shop-clients' | 'bank-cards' | 'warehouses' | 'shop-data'
type SeoShopDataSearchTarget = 'bank-cards' | 'clients' | 'storages'
type PaymentCardBrand = 'mastercard' | 'unknown' | 'visa'

type SeoRosterColumn<TData> = {
  id: string
  header: ReactNode
  accessor?: (row: TData) => unknown
  cell?: (row: TData) => ReactNode
  width?: number
  minWidth?: number
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  className?: string
  fill?: boolean
  enableHiding?: boolean
  enablePinning?: boolean
  enableReorder?: boolean
  enableResizing?: boolean
  enableSorting?: boolean
}

const SEO_TABS: { value: SeoTab; label: TranslationKey }[] = [
  { value: 'info-payment', label: 'Загальна інформація та оплата' },
  { value: 'pages', label: 'Сторінки' },
  { value: 'contacts', label: 'Персонал' },
  { value: 'shop-data', label: 'Дані магазину' },
  { value: 'shop-clients', label: 'Інтернет клієнти' },
  { value: 'bank-cards', label: 'Банківські картки' },
  { value: 'warehouses', label: 'Склади' },
]

const SEO_VISIBLE_TABS = SEO_TABS.filter((tab) => !['shop-clients', 'bank-cards', 'warehouses'].includes(tab.value))

const SEO_SHOP_DATA_SEARCH_TARGET_OPTIONS: Array<{ value: SeoShopDataSearchTarget; label: TranslationKey }> = [
  { value: 'clients', label: 'Пошук по інтернет клієнтах' },
  { value: 'bank-cards', label: 'Пошук по банківських картах' },
  { value: 'storages', label: 'Пошук по складах' },
]

const SEO_SHOP_DATA_SEARCH_PLACEHOLDERS: Record<SeoShopDataSearchTarget, TranslationKey> = {
  'bank-cards': 'Рахунок, назва, банк або організація',
  clients: 'Клієнт, договір, номер або статус',
  storages: 'Склад, організація, пріоритет або статус',
}

const DEFAULT_SEO_TAB: SeoTab = 'info-payment'
const SEO_TAB_VALUES = new Set<SeoTab>(SEO_TABS.map((tab) => tab.value))

const EMPTY_PAGE_FORM_VALUES = pageToFormValues(null)
const EMPTY_CONTACT_FORM_VALUES = contactToFormValues(null)

type SeoGeneralMatrixGroup = 'contact' | 'payment'
type SeoGeneralContactFieldId = keyof SeoContactInfoFormValues
type SeoGeneralPaymentFieldId = keyof SeoPaymentFormValues

type SeoGeneralMatrixField =
  | {
    description: TranslationKey
    group: 'contact'
    id: SeoGeneralContactFieldId
    input: 'text' | 'textarea'
    label: TranslationKey
  }
  | {
    description: TranslationKey
    group: 'payment'
    id: SeoGeneralPaymentFieldId
    input: 'text' | 'textarea'
    label: TranslationKey
  }

type SeoGeneralMatrixSection = {
  description: TranslationKey
  fields: SeoGeneralMatrixField[]
  group: SeoGeneralMatrixGroup
  label: TranslationKey
}

const SEO_GENERAL_MATRIX_SECTIONS: SeoGeneralMatrixSection[] = [
  {
    description: 'Адреса, телефон, пошта, сайт і Pixel ID',
    fields: [
      { description: 'Публічна адреса магазину', group: 'contact', id: 'Address', input: 'textarea', label: 'Адреса' },
      { description: 'Основний телефон для клієнтів', group: 'contact', id: 'Phone', input: 'text', label: 'Телефон' },
      { description: 'Поштова скринька магазину', group: 'contact', id: 'Email', input: 'text', label: 'E-mail' },
      { description: 'Посилання на сайт', group: 'contact', id: 'SiteUrl', input: 'text', label: 'Site URL' },
      { description: 'Ідентифікатор рекламного пікселя', group: 'contact', id: 'PixelId', input: 'text', label: 'Pixel ID' },
    ],
    group: 'contact',
    label: 'Загальна інформація',
  },
  {
    description: 'Суми, коментарі та повідомлення оформлення',
    fields: [
      { description: 'Текст або сума передплати', group: 'payment', id: 'LowPrice', input: 'text', label: 'Передплата' },
      { description: 'Текст або сума повної ціни', group: 'payment', id: 'FullPrice', input: 'text', label: 'Повна ціна' },
      { description: 'Коментар для платіжної картки', group: 'payment', id: 'Comment', input: 'textarea', label: 'Коментар для картки' },
      {
        description: 'Текст після швидкого замовлення',
        group: 'payment',
        id: 'FastOrderSuccessMessage',
        input: 'textarea',
        label: 'Повідомлення про успішне замовлення',
      },
      { description: 'Повідомлення для сценарію зі скріншотом', group: 'payment', id: 'ScreenshotMessage', input: 'textarea', label: 'Повідомлення' },
    ],
    group: 'payment',
    label: 'Оплата',
  },
]

function useOnlineShopSeoPageModel(activeTab: SeoTab, setActiveTab: (tab: SeoTab) => void) {
  const { t } = useI18n()
  const [settings, setSettings] = useValueState<SeoLocaleEntry[]>([])
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
  const [shopDataSearchDraft, setShopDataSearchDraft] = useValueState('')
  const [shopDataSearchValue, setShopDataSearchValue] = useValueState('')
  const [shopDataSearchTarget, setShopDataSearchTarget] = useValueState<SeoShopDataSearchTarget>('clients')
  const [editingGeneralLocale, setEditingGeneralLocale] = useValueState<string | null>(null)
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
  const shopDataClients = useMemo(
    () => (shopDataSearchTarget === 'clients' ? filterOnlineShopClients(onlineShopClients, shopDataSearchValue) : onlineShopClients),
    [onlineShopClients, shopDataSearchTarget, shopDataSearchValue],
  )
  const shopDataCards = useMemo(
    () => (shopDataSearchTarget === 'bank-cards' ? filterPaymentRegisters(paymentRegisters, shopDataSearchValue) : paymentRegisters),
    [paymentRegisters, shopDataSearchTarget, shopDataSearchValue],
  )
  const shopDataStorages = useMemo(
    () => (shopDataSearchTarget === 'storages' ? filterStorages(ecommerceStorages, shopDataSearchValue) : ecommerceStorages),
    [ecommerceStorages, shopDataSearchTarget, shopDataSearchValue],
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

  const pageColumns = useMemo<SeoRosterColumn<SeoPageRow>[]>(
    () => [
      {
        id: 'page',
        header: 'Сторінка',
        width: 250,
        minWidth: 180,
        accessor: (row) => getPageTitle(row.page),
        cell: (row) => (
          <SeoTablePrimaryCell
            subtitle={shortText(row.page.Description, 120)}
            title={displayValue(getPageTitle(row.page))}
          />
        ),
      },
      {
        id: 'url',
        header: 'URL',
        width: 220,
        minWidth: 180,
        accessor: (row) => row.page.Url,
        cell: (row) => (
          <SeoTableRoleLikeCell icon={<Link size={14} />} tone="url">
            {displayValue(row.page.Url)}
          </SeoTableRoleLikeCell>
        ),
      },
      {
        id: 'title',
        header: 'Title',
        width: 260,
        minWidth: 220,
        accessor: (row) => row.page.Title,
        cell: (row) => (
          <SeoTableTextCell primary={shortText(row.page.Title, 120)} />
        ),
      },
      {
        id: 'locale',
        header: 'Мова',
        width: 96,
        minWidth: 84,
        accessor: (row) => row.locale,
        cell: (row) => <SeoTableLocaleTag>{getLocaleLabel(row.locale)}</SeoTableLocaleTag>,
      },
      {
        id: 'updated',
        header: 'Оновлено',
        width: 152,
        minWidth: 132,
        accessor: (row) => formatDateTime(row.page.Updated),
        cell: (row) => <SeoTableDateCell value={row.page.Updated} />,
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
          <SeoTableActionCell>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon aria-label={t('Редагувати')} color="gray" variant="subtle" onClick={() => openPageEditor(row)}>
                <Pencil size={18} />
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
    ],
    [openPageEditor, t],
  )

  const contactColumns = useMemo<SeoRosterColumn<SeoContact>[]>(
    () => [
      {
        id: 'contact',
        header: 'Контакт',
        width: 260,
        minWidth: 220,
        accessor: getSeoContactDisplayName,
        cell: (contact) => <SeoTableContactProfileCell contact={contact} />,
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 180,
        minWidth: 150,
        accessor: (contact) => contact.Phone,
        cell: (contact) => (
          <SeoTableRoleLikeCell icon={<Phone size={14} />}>
            {displayValue(contact.Phone)}
          </SeoTableRoleLikeCell>
        ),
      },
      {
        id: 'email',
        header: 'E-mail',
        width: 240,
        minWidth: 190,
        accessor: (contact) => contact.Email,
        cell: (contact) => <SeoTableMutedCell tone="strong">{displayValue(contact.Email)}</SeoTableMutedCell>,
      },
      {
        id: 'updated',
        header: 'Оновлено',
        width: 152,
        minWidth: 132,
        accessor: (contact) => formatDateTime(contact.Updated),
        cell: (contact) => <SeoTableDateCell value={contact.Updated} />,
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
          <SeoTableActionCell>
            <Tooltip label={t('Редагувати')}>
              <ActionIcon
                aria-label={t('Редагувати')}
                color="gray"
                variant="subtle"
                onClick={() => openContactEditor(contact)}
              >
                <Pencil size={18} />
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
                <Trash2 size={18} />
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
    ],
    [openContactEditor, requestRemoveContact, t],
  )

  const clientColumns: SeoRosterColumn<OnlineShopClient>[] = [
      {
        id: 'status',
        header: 'Статус',
        width: 132,
        minWidth: 118,
        accessor: (client) => Boolean(client.IsForRetail),
        cell: (client) => <SeoTableStatusPill active={Boolean(client.IsForRetail)} activeLabel="Активний" inactiveLabel="Не активний" />,
      },
      {
        id: 'client',
        header: 'Клієнт',
        width: 280,
        minWidth: 220,
        accessor: (client) => getClientDisplayName(client),
        cell: (client) => (
          <SeoTablePrimaryCell
            avatar={(
              <Avatar className="seo-table-avatar" radius="xl">
                {getClientInitials(client)}
              </Avatar>
            )}
            title={displayValue(getClientDisplayName(client))}
          />
        ),
      },
      {
        id: 'clientNumber',
        header: 'Номер',
        width: 140,
        minWidth: 110,
        accessor: (client) => client.ClientNumber,
        cell: (client) => <SeoTableTag>{displayValue(client.ClientNumber)}</SeoTableTag>,
      },
      {
        id: 'phone',
        header: 'Телефон',
        width: 180,
        minWidth: 150,
        accessor: (client) => getClientPhone(client),
        cell: (client) => <SeoTableTextCell primary={displayValue(getClientPhone(client))} />,
      },
      {
        id: 'email',
        header: 'E-mail',
        width: 240,
        minWidth: 190,
        accessor: (client) => client.EmailAddress,
        cell: (client) => <SeoTableMutedCell>{displayValue(client.EmailAddress)}</SeoTableMutedCell>,
      },
      {
        id: 'clientActive',
        header: 'Активність',
        width: 128,
        minWidth: 118,
        accessor: (client) => Boolean(client.IsActive),
        cell: (client) => <SeoTableStatusPill active={Boolean(client.IsActive)} activeLabel="Активний" inactiveLabel="Не активний" />,
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
          <SeoTableActionCell>
            <Tooltip label={client.IsForRetail ? t('Вимкнути') : t('Увімкнути')}>
              <ActionIcon
                aria-label={client.IsForRetail ? t('Вимкнути') : t('Увімкнути')}
                color={client.IsForRetail ? 'red' : 'green'}
                disabled={!client.NetUid || isSaving}
                variant="subtle"
                onClick={() => void handleToggleOnlineShopClient(client)}
              >
                {client.IsForRetail ? <X size={18} /> : <Check size={18} />}
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
  ]

  const paymentRegisterColumns: SeoRosterColumn<OnlineShopPaymentRegister>[] = [
      {
        id: 'status',
        header: 'Статус',
        width: 128,
        minWidth: 116,
        accessor: (register) => Boolean(register.IsSelected),
        cell: (register) => <SeoTableStatusPill active={Boolean(register.IsSelected)} activeLabel="Активна" inactiveLabel="Не активна" />,
      },
      {
        id: 'accountNumber',
        header: 'Рахунок',
        width: 180,
        minWidth: 150,
        accessor: (register) => register.AccountNumber || register.IBAN,
        cell: (register) => (
          <SeoTablePrimaryCell
            title={displayValue(register.AccountNumber || register.IBAN)}
          />
        ),
      },
      {
        id: 'currency',
        header: 'Валюта',
        width: 112,
        minWidth: 92,
        accessor: (register) => getPaymentRegisterCurrency(register),
        cell: (register) => <SeoTableTag tone="accent">{displayValue(getPaymentRegisterCurrency(register))}</SeoTableTag>,
      },
      {
        id: 'name',
        header: 'Назва',
        width: 240,
        minWidth: 190,
        accessor: (register) => register.Name,
        cell: (register) => <SeoTableTextCell primary={displayValue(register.Name)} />,
      },
      {
        id: 'bankName',
        header: 'Банк',
        width: 220,
        minWidth: 180,
        accessor: (register) => register.BankName,
        cell: (register) => <SeoTableMutedCell>{displayValue(register.BankName)}</SeoTableMutedCell>,
      },
      {
        id: 'organization',
        header: 'Організація',
        width: 280,
        minWidth: 220,
        accessor: (register) => getOrganizationName(register.Organization),
        cell: (register) => <SeoTableMutedCell>{displayValue(getOrganizationName(register.Organization))}</SeoTableMutedCell>,
      },
      {
        id: 'registerActive',
        header: 'Активність',
        width: 128,
        minWidth: 118,
        accessor: (register) => Boolean(register.IsActive),
        cell: (register) => <SeoTableStatusPill active={Boolean(register.IsActive)} activeLabel="Активна" inactiveLabel="Не активна" />,
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
          <SeoTableActionCell>
            <Tooltip label={t('Обрати')}>
              <ActionIcon
                aria-label={t('Обрати')}
                color={register.IsSelected ? 'green' : 'gray'}
                disabled={!register.NetUid || isSaving}
                variant="subtle"
                onClick={() => void handleSelectPaymentRegister(register)}
              >
                <Check size={18} />
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
  ]

  const ecommerceStorageColumns = useMemo<SeoRosterColumn<OnlineShopStorage>[]>(
    () => [
      {
        id: 'storage',
        header: '',
        width: 420,
        minWidth: 320,
        accessor: (storage) => storage.Name,
        cell: (storage) => <SeoTableStorageCell storage={storage} />,
      },
      {
        id: 'priority',
        header: 'Пріоритет',
        width: 112,
        minWidth: 100,
        accessor: (storage) => Number(storage.RetailPriority || 0),
        cell: (storage) => (
          <SeoTableRoleLikeCell icon={<Hash size={14} />} tone="url">
            {displayValue(storage.RetailPriority)}
          </SeoTableRoleLikeCell>
        ),
      },
      {
        id: 'status',
        header: 'Статус',
        width: 126,
        minWidth: 112,
        accessor: (storage) => Boolean(storage.ForEcommerce),
        cell: (storage) => <SeoTableStatusPill active={Boolean(storage.ForEcommerce)} activeLabel="Активний" inactiveLabel="Не активний" />,
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
          <SeoTableActionCell>
            <Tooltip label={t('Змінити пріоритет')}>
              <ActionIcon
                aria-label={t('Змінити пріоритет')}
                color="gray"
                disabled={!storage.Id || isSaving}
                variant="subtle"
                onClick={() => openPriorityEditor(storage)}
              >
                <Pencil size={18} />
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
                <Trash2 size={18} />
              </ActionIcon>
            </Tooltip>
          </SeoTableActionCell>
        ),
      },
    ],
    [isSaving, openPriorityEditor, requestRemoveStorage, t],
  )

  const allStorageColumns: SeoRosterColumn<OnlineShopStorage>[] = [
      {
        id: 'storage',
        header: '',
        width: 420,
        minWidth: 320,
        accessor: (storage) => storage.Name,
        cell: (storage) => <SeoTableStorageCell storage={storage} />,
      },
      {
        id: 'priority',
        header: 'Пріоритет',
        width: 112,
        minWidth: 100,
        accessor: (storage) => Number(storage.RetailPriority || 0),
        cell: (storage) => (
          <SeoTableRoleLikeCell icon={<Hash size={14} />} tone="url">
            {displayValue(storage.RetailPriority)}
          </SeoTableRoleLikeCell>
        ),
      },
      {
        id: 'status',
        header: 'Статус',
        width: 126,
        minWidth: 112,
        accessor: (storage) => isStorageActive(storage, ecommerceStorages),
        cell: (storage) => (
          <SeoTableStatusPill
            active={isStorageActive(storage, ecommerceStorages)}
            activeLabel="Активний"
            inactiveLabel="Не активний"
          />
        ),
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
            <SeoTableActionCell>
              <Tooltip label={active ? t('Вже додано') : t('Додати')}>
                <ActionIcon
                  aria-label={active ? t('Вже додано') : t('Додати')}
                  color={active ? 'green' : 'gray'}
                  disabled={active || !storage.NetUid || isSaving}
                  variant="subtle"
                  onClick={() => void handleAddStorage(storage)}
                >
                  <Plus size={18} />
                </ActionIcon>
              </Tooltip>
            </SeoTableActionCell>
          )
        },
      },
  ]

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

  function changeShopDataSearch(value: string) {
    setShopDataSearchDraft(value)
    setShopDataSearchValue(value.trim())
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

  function resetShopDataSearch() {
    setShopDataSearchDraft('')
    setShopDataSearchValue('')
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

  const openGeneralLocaleEditor = useCallback((entry: SeoLocaleEntry) => {
    setEditingGeneralLocale(entry.locale)
    setFormError(null)
  }, [setEditingGeneralLocale, setFormError])

  function closeGeneralLocaleEditor() {
    setEditingGeneralLocale(null)
    setFormError(null)
  }

  async function handleSaveContactInfo(locale: string, contactInfo: SeoContactInfo | null, values: SeoContactInfoFormValues) {
    setSaving(true)
    setError(null)
    setFormError(null)

    try {
      const nextSettings = await updateSeoContactInfo({
        ...(contactInfo || {}),
        ...values,
        Locale: contactInfo?.Locale || locale,
      })

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('Контактну інформацію оновлено') })
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти контактну інформацію'))
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
    setFormError(null)

    try {
      const nextSettings = await updateSeoPaymentInfo({
        ...(payment || {}),
        ...values,
        CultureCode: payment?.CultureCode || locale,
      })

      setSettings(nextSettings)
      notifications.show({ color: 'green', message: t('Інформацію про оплату оновлено') })
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти інформацію про оплату'))
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
    t, activeStorages, activeTab, allStorageColumns, allStorageSearchDraft,
    availableStorages, cardSearchDraft, cards, clientColumns, clientSearchDraft, clients,
    contactColumns, contactFormValues, contactSearchDraft, contacts,
    ecommerceStorageColumns, ecommerceStorages, editingContact, editingGeneralLocale, error, formError, isCardsLoading,
    isClientsLoading, isContactEditorOpen, isImageUploading, isLoading, isPageEditorOpen, isSaving,
    isStorageDrawerOpen, isStoragesLoading, pageColumns, pageFormValues, pageRows, pageSearchDraft,
    paymentRegisterColumns, priorityStorageTarget, priorityValue, removeContactTarget,
    shopDataCards, shopDataClients, shopDataSearchDraft, shopDataSearchTarget, shopDataStorages,
    removeStorageTarget, settings, storageSearchDraft, allStorageSearchValue,
    cardSearchValue, clientSearchValue, contactSearchValue, pageSearchValue, storageSearchValue,
    changeAllStorageSearch, changeCardSearch, changeClientSearch, changeContactSearch, changePageSearch,
    changeShopDataSearch,
    changeStorageSearch, closeContactEditor, closeGeneralLocaleEditor, closePageEditor, closePriorityEditor, handleAddStorage, handleContactImageChange,
    handleRemoveContact, handleRemoveStorage, handleSaveContact, handleSaveContactInfo, handleSavePage,
    handleSavePayment, handleSaveStoragePriority, handleSelectPaymentRegister, handleToggleOnlineShopClient,
    openContactEditor, openGeneralLocaleEditor, openPageEditor, reload, resetAllStorageSearch, resetCardSearch, resetClientSearch,
    resetShopDataSearch,
    resetContactSearch, resetPageSearch, resetStorageSearch, setActiveTab, setContactField, setFormError,
    setShopDataSearchTarget,
    setPageField, setPriorityValue, setRemoveContactTarget, setRemoveStorageTarget,
    setStorageDrawerOpen,
  }
}

export function OnlineShopSeoPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { tab } = useParams<{ tab?: string }>()
  const activeTab = getSeoTabFromSlug(tab)
  const activeTabLabel = SEO_TABS.find((item) => item.value === activeTab)?.label || 'Загальна інформація та оплата'
  const setActiveTab = useCallback(
    (nextTab: SeoTab) => {
      navigate(getSeoTabHref(nextTab))
    },
    [navigate],
  )

  useEffect(() => {
    if (!isSeoTabSlug(tab)) {
      navigate(getSeoTabHref(activeTab), { replace: true })
    }
  }, [activeTab, navigate, tab])

  usePageBreadcrumb(t(activeTabLabel))

  const model = useOnlineShopSeoPageModel(activeTab, setActiveTab)

  return renderOnlineShopSeoPage(model)
}

function renderOnlineShopSeoPage(model: ReturnType<typeof useOnlineShopSeoPageModel>) {
  const {
    t, activeStorages, activeTab, allStorageColumns, allStorageSearchDraft,
    availableStorages, cardSearchDraft, cards, clientColumns, clientSearchDraft, clients,
    contactColumns, contactFormValues, contactSearchDraft, contacts,
    ecommerceStorageColumns, ecommerceStorages, editingContact, editingGeneralLocale, error, formError, isCardsLoading,
    isClientsLoading, isContactEditorOpen, isImageUploading, isLoading, isPageEditorOpen, isSaving,
    isStorageDrawerOpen, isStoragesLoading, pageColumns, pageFormValues, pageRows, pageSearchDraft,
    paymentRegisterColumns, priorityStorageTarget, priorityValue, removeContactTarget,
    shopDataCards, shopDataClients, shopDataSearchDraft, shopDataSearchTarget, shopDataStorages,
    removeStorageTarget, settings, storageSearchDraft, closeContactEditor, closeGeneralLocaleEditor, closePageEditor,
    closePriorityEditor, handleAddStorage, handleContactImageChange, handleRemoveContact, handleRemoveStorage,
    handleSaveContact, handleSaveContactInfo, handleSavePage, handleSavePayment, handleSaveStoragePriority,
    handleSelectPaymentRegister, handleToggleOnlineShopClient, changeAllStorageSearch, changeCardSearch,
    changeClientSearch, changeContactSearch, changePageSearch, changeShopDataSearch, changeStorageSearch,
    openContactEditor, openGeneralLocaleEditor, openPageEditor, reload,
    resetAllStorageSearch, resetCardSearch, resetClientSearch, resetContactSearch, resetPageSearch,
    resetShopDataSearch,
    resetStorageSearch, setActiveTab, setContactField, setFormError, setPageField, setPriorityValue,
    setRemoveContactTarget, setRemoveStorageTarget, setStorageDrawerOpen,
    setShopDataSearchTarget,
  } = model
  const commandSearch = getSeoCommandSearchConfig(activeTab, {
    cardSearchDraft,
    changeCardSearch,
    changeClientSearch,
    changeContactSearch,
    changePageSearch,
    changeShopDataSearch,
    changeStorageSearch,
    clientSearchDraft,
    contactSearchDraft,
    pageSearchDraft,
    resetCardSearch,
    resetClientSearch,
    resetContactSearch,
    resetPageSearch,
    resetShopDataSearch,
    resetStorageSearch,
    setShopDataSearchTarget,
    shopDataSearchDraft,
    shopDataSearchTarget,
    storageSearchDraft,
  })
  const isActiveTabRefreshing = getSeoTabLoadingState(activeTab, {
    isCardsLoading,
    isClientsLoading,
    isLoading,
    isStoragesLoading,
  })
  const commandSummary = activeTab === 'shop-data'
    ? {
      description: 'Інтернет клієнти, банківські картки та склади в одному робочому екрані.',
      title: 'Дані магазину',
    }
    : {
      description: 'Контактна інформація та дані оплати для інтернет-магазину.',
      title: 'Основні налаштування',
    }
  const showCommandBar = activeTab !== 'info-payment'
  const isPatternFilterTab = activeTab === 'pages' || activeTab === 'contacts' || activeTab === 'shop-data'
  const headerAction = activeTab === 'contacts'
    ? (
      <Button
        color={CREATE_ACTION_COLOR}
        leftSection={<Plus size={14} />}
        size="sm"
        type="button"
        onClick={() => openContactEditor()}
      >
        {t('Новий контакт')}
      </Button>
    )
    : activeTab === 'warehouses' || activeTab === 'shop-data'
      ? (
        <Button
          color={CREATE_ACTION_COLOR}
          leftSection={<Plus size={14} />}
          size="sm"
          type="button"
          onClick={() => setStorageDrawerOpen(true)}
        >
          {t('Додати склад')}
        </Button>
      )
      : null
  const generalEntries = getOrderedSeoGeneralEntries(settings)
  const generalEditorEntry = editingGeneralLocale
    ? settings.find((entry) => entry.locale === editingGeneralLocale) || null
    : null
  return (
    <Stack
      className={`seo-page console-table-page${isPatternFilterTab ? ` is-filtered is-${activeTab}` : ''}`}
      gap={6}
    >
      <Box className="seo-page-shell">
        {showCommandBar && (
          <div className="app-filter-bar seo-page-command-bar">
            {commandSearch ? (
              <div className={`seo-page-command-search${commandSearch.filterOptions ? ' has-filter' : ''}`}>
                {commandSearch.filterOptions && commandSearch.filterValue && commandSearch.onFilterChange ? (
                  <div className="app-filter-field seo-page-command-combo">
                    <Text className="app-filter-label seo-page-command-combo-label">{t(commandSearch.label)}</Text>
                    <div className="seo-page-command-combo-control">
                      <Select
                        allowDeselect={false}
                        aria-label={t(commandSearch.filterLabel || 'Шукати по')}
                        className="seo-page-command-combo-filter"
                        data={commandSearch.filterOptions.map((option) => ({
                          label: t(option.label),
                          value: option.value,
                        }))}
                        rightSectionWidth={24}
                        value={commandSearch.filterValue}
                        variant="unstyled"
                        onChange={(value) => commandSearch.onFilterChange?.(value || commandSearch.filterValue || '')}
                      />
                      <span className="seo-page-command-combo-divider" aria-hidden />
                      <TextInput
                        aria-label={t(commandSearch.label)}
                        className="seo-page-command-combo-input"
                        leftSection={<Search size={15} />}
                        placeholder={t(commandSearch.placeholder)}
                        value={commandSearch.value}
                        variant="unstyled"
                        onChange={(event) => commandSearch.onChange(event.currentTarget.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <TextInput
                    className="seo-page-search-input"
                    leftSection={<Search size={15} />}
                    label={t(commandSearch.label)}
                    placeholder={t(commandSearch.placeholder)}
                    value={commandSearch.value}
                    onChange={(event) => commandSearch.onChange(event.currentTarget.value)}
                  />
                )}
              </div>
            ) : (
              <div className="seo-page-command-summary">
                <Text className="seo-page-command-summary-description">
                  {t(commandSummary.description)}
                </Text>
                <Text className="seo-page-command-summary-title">{t(commandSummary.title)}</Text>
              </div>
            )}
            <div className="app-filter-actions seo-page-toolbar-actions">
              {commandSearch && (
                <Tooltip label={t('Скинути')}>
                  <ActionIcon
                    aria-label={t('Скинути')}
                    color="gray"
                    disabled={!commandSearch.value}
                    size={34}
                    type="button"
                    variant="light"
                    onClick={commandSearch.onReset}
                  >
                    <RotateCcw size={17} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label={t('Оновити')}>
                <ActionIcon
                  aria-label={t('Оновити')}
                  color="gray"
                  loading={isActiveTabRefreshing}
                  size={34}
                  variant="light"
                  onClick={() => reload()}
                >
                  <RefreshCw size={17} />
                </ActionIcon>
              </Tooltip>
              {headerAction}
            </div>
          </div>
        )}

        {error && (
          <Alert className={isPatternFilterTab ? 'console-table-alert' : undefined} color="red" icon={<CircleAlert size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <div className="seo-page-workspace">
          <aside className="seo-page-rail">
            <div className="seo-page-rail-header">
              <span>{t('Розділи')}</span>
            </div>
            <div className="seo-page-nav">
              {SEO_VISIBLE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`seo-page-nav-item online-shop-seo-nav-item${activeTab === tab.value ? ' is-active' : ''}`}
                  aria-pressed={activeTab === tab.value}
                  onClick={() => setActiveTab(tab.value)}
                >
                  <span className="online-shop-seo-nav-item-label">{t(tab.label)}</span>
                  <ChevronRight className="online-shop-seo-nav-item-chevron" size={16} strokeWidth={2} aria-hidden />
                </button>
              ))}
            </div>
          </aside>

          <section className="seo-page-panel">
          <Box className="seo-page-panel-body">
            {activeTab === 'pages' && (
              <Box className="seo-page-table-view" pt="md">
              <Stack className="seo-page-table-stack" gap="md">
                <SeoRosterTable
                  columns={pageColumns}
                  columnsTemplate="minmax(280px, 1.25fr) minmax(180px, 0.74fr) minmax(140px, 0.64fr) 88px 138px 42px"
                  data={pageRows}
                  emptyText={t('Сторінок не знайдено')}
                  getRowClassName={(row) => (row.locale === 'ru' ? 'is-ru' : undefined)}
                  getRowId={(row, index) => `${row.locale}-${row.page.NetUid || row.page.Id || index}`}
                  isLoading={isLoading}
                  loadingText={t('Завантаження сторінок')}
                  fillHeight
                  minWidth={900}
                  onRowClick={openPageEditor}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'info-payment' && (
              <Box className="seo-general-content" pt="md">
                <div className="seo-matrix">
                  {generalEntries.length ? (
                    <div className="seo-settings-tree">
                      {generalEntries.map((entry, localeIndex) => (
                        <section
                          className={`seo-settings-tree-module${localeIndex > 0 ? ' is-separated' : ''}`}
                          key={entry.locale}
                        >
                          <div className="seo-settings-tree-module-header">
                            <div className="seo-settings-tree-module-title">
                              <Text className="app-section-title seo-settings-tree-module-name" fw={600} size="sm">{entry.locale}</Text>
                            </div>
                            <Tooltip label={t('Редагувати')}>
                              <ActionIcon
                                aria-label={`${t('Редагувати')} ${entry.locale}`}
                                className="seo-settings-tree-action"
                                color="gray"
                                disabled={isSaving}
                                size={26}
                                type="button"
                                variant="subtle"
                                onClick={() => openGeneralLocaleEditor(entry)}
                              >
                                <Pencil size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </div>

                          <div className="seo-settings-tree-node-list">
                            {SEO_GENERAL_MATRIX_SECTIONS.map((section) => {
                              return (
                                <article className="seo-settings-tree-node" key={`${entry.locale}-${section.group}`}>
                                  <div className="seo-settings-tree-node-row">
                                    <div className="seo-settings-tree-node-title">
                                      <Text className="seo-settings-tree-node-name">{t(section.label)}</Text>
                                    </div>
                                  </div>

                                  <div className="seo-settings-tree-field-list">
                                    {section.fields.map((field) => {
                                      const value = getSeoGeneralMatrixValue(entry, field)
                                      const isMissingRecord = !isSeoGeneralMatrixFieldEditable(entry, field)

                                      return (
                                        <div
                                          className={`seo-settings-tree-field${value ? '' : ' is-empty'}${isMissingRecord ? ' is-disabled' : ''}`}
                                          key={`${entry.locale}-${field.group}-${field.id}`}
                                        >
                                          <span className="seo-settings-tree-connector" aria-hidden />
                                          <div className="seo-settings-tree-field-content">
                                            <div className="seo-settings-tree-field-body">
                                              <Text className="seo-settings-tree-field-name">{t(field.label)}</Text>
                                            </div>
                                            <span className="seo-settings-tree-field-line" aria-hidden />
                                            <span className="seo-settings-tree-field-value">
                                              {isMissingRecord ? t('Запис відсутній') : displayValue(value, t('Не заповнено'))}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="seo-matrix-empty">
                      <Text c="dimmed" size="sm">{t('Даних для редагування не знайдено')}</Text>
                    </div>
                  )}
                </div>
              </Box>
            )}

            {activeTab === 'contacts' && (
              <Box className="seo-page-table-view" pt="md">
              <Stack className="seo-page-table-stack" gap="md">
                <SeoRosterTable
                  columns={contactColumns}
                  columnsTemplate="minmax(240px, 1fr) 170px 220px 138px 94px"
                  data={contacts}
                  emptyText={t('Контактів не знайдено')}
                  getRowId={(contact, index) => String(contact.NetUid || contact.Id || index)}
                  isLoading={isLoading}
                  loadingText={t('Завантаження контактів')}
                  fillHeight
                  minWidth={862}
                  onRowClick={openContactEditor}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'shop-data' && (
              <Box pt="md">
                <div className="seo-shop-data-grid">
                  <div className="seo-shop-data-column">
                    <SeoShopDataSection
                      className="is-clients"
                      count={shopDataClients.length}
                      hideCount
                      title={t('Інтернет клієнти')}
                    >
                      <SeoShopClientList
                        clients={shopDataClients}
                        emptyText={t('Клієнтів не знайдено')}
                        isLoading={isClientsLoading}
                        loadingText={t('Завантаження клієнтів')}
                        onToggleClient={handleToggleOnlineShopClient}
                      />
                    </SeoShopDataSection>

                    <SeoShopDataSection
                      className="is-storages"
                      count={shopDataStorages.length}
                      hideCount
                      title={t('Склади')}
                    >
                      <SeoRosterTable
                        columns={ecommerceStorageColumns}
                        columnsTemplate="minmax(360px, 1fr) 118px 100px 82px"
                      data={shopDataStorages}
                      emptyText={t('Активних складів не знайдено')}
                      getRowClassName={() => 'is-hoverable'}
                      getRowId={(storage, index) => String(storage.NetUid || storage.Id || index)}
                        isLoading={isStoragesLoading}
                        loadingText={t('Завантаження складів')}
                        minWidth={660}
                      />
                    </SeoShopDataSection>
                  </div>

                  <SeoShopDataSection
                    count={shopDataCards.length}
                    hideCount
                    title={t('Банківські картки')}
                  >
                    <SeoShopCardList
                      cards={shopDataCards}
                      emptyText={t('Банківських карток не знайдено')}
                      isLoading={isCardsLoading}
                      isSaving={isSaving}
                      loadingText={t('Завантаження карток')}
                      onSelectCard={handleSelectPaymentRegister}
                    />
                  </SeoShopDataSection>
                </div>
              </Box>
            )}

            {activeTab === 'shop-clients' && (
              <Box pt="md">
              <Stack gap="md">
                <SeoRosterTable
                  columns={clientColumns}
                  columnsTemplate="118px minmax(250px, 1fr) 118px 170px 220px 118px 54px"
                  data={clients}
                  emptyText={t('Клієнтів не знайдено')}
                  getRowId={(client, index) => String(client.NetUid || client.Id || index)}
                  isLoading={isClientsLoading}
                  loadingText={t('Завантаження клієнтів')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1048}
                  onRowClick={(client) => void handleToggleOnlineShopClient(client)}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'bank-cards' && (
              <Box pt="md">
              <Stack gap="md">
                <SeoRosterTable
                  columns={paymentRegisterColumns}
                  columnsTemplate="118px minmax(220px, 0.9fr) 88px minmax(210px, 1fr) minmax(190px, 0.85fr) minmax(240px, 1fr) 118px 54px"
                  data={cards}
                  emptyText={t('Банківських карток не знайдено')}
                  getRowId={(register, index) => String(register.NetUid || register.Id || index)}
                  isLoading={isCardsLoading}
                  loadingText={t('Завантаження карток')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={1236}
                  onRowClick={(register) => void handleSelectPaymentRegister(register)}
                />
              </Stack>
              </Box>
            )}

            {activeTab === 'warehouses' && (
              <Box pt="md">
              <Stack gap="md">
                <SeoRosterTable
                  columns={ecommerceStorageColumns}
                  columnsTemplate="minmax(360px, 1fr) 118px 100px 82px"
                  data={activeStorages}
                  emptyText={t('Активних складів не знайдено')}
                  getRowClassName={() => 'is-hoverable'}
                  getRowId={(storage, index) => String(storage.NetUid || storage.Id || index)}
                  isLoading={isStoragesLoading}
                  loadingText={t('Завантаження складів')}
                  maxHeight="calc(100vh - 340px)"
                  minWidth={660}
                />
              </Stack>
              </Box>
            )}
          </Box>
          </section>
        </div>
      </Box>

      <AppDrawer
        opened={Boolean(generalEditorEntry)}
        size="standard"
        title={
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {generalEditorEntry ? `${t('Редагування')} ${getLocaleLabel(generalEditorEntry.locale)}` : t('Редагування')}
          </span>
        }
        onClose={closeGeneralLocaleEditor}
      >
        {generalEditorEntry && (
          <Stack className="seo-general-sheet" gap="md">
            {formError && (
              <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <div className="seo-general-sheet-context">
              <div className="seo-matrix-editor-context">
                <Badge className="seo-matrix-locale-pill" variant="light">
                  {getLocaleLabel(generalEditorEntry.locale)}
                </Badge>
                <span>
                  <Text className="seo-matrix-editor-eyebrow">{t('Мовна версія')}</Text>
                  <Text className="seo-matrix-editor-title">{generalEditorEntry.locale}</Text>
                </span>
              </div>
            </div>

            <section className="seo-general-sheet-section">
              <div className="seo-general-sheet-section-header">
                <span>
                  <Text className="app-section-title" fw={600} size="sm">{t('Загальна інформація')}</Text>
                  <Text className="seo-matrix-section-description">
                    {t('Адреса, телефон, пошта, сайт і Pixel ID для вибраної мови.')}
                  </Text>
                </span>
              </div>
              <ContactInfoForm
                key={`${generalEditorEntry.locale}-${generalEditorEntry.settings.EcommerceContactInfo?.NetUid || 'new'}`}
                contactInfo={generalEditorEntry.settings.EcommerceContactInfo || null}
                isSaving={isSaving}
                locale={generalEditorEntry.locale}
                onSave={handleSaveContactInfo}
              />
            </section>

            <section className="seo-general-sheet-section">
              <div className="seo-general-sheet-section-header">
                <span>
                  <Text className="app-section-title" fw={600} size="sm">{t('Оплата')}</Text>
                  <Text className="seo-matrix-section-description">
                    {t('Суми, коментарі та повідомлення, які бачить клієнт під час оформлення.')}
                  </Text>
                </span>
              </div>
              <PaymentInfoForm
                key={`${generalEditorEntry.locale}-${generalEditorEntry.settings.RetailPaymentTypeTranslate?.NetUid || 'new'}`}
                isSaving={isSaving}
                locale={generalEditorEntry.locale}
                payment={generalEditorEntry.settings.RetailPaymentTypeTranslate || null}
                onSave={handleSavePayment}
              />
            </section>
          </Stack>
        )}
      </AppDrawer>

      <AppModal centered opened={isPageEditorOpen} size="xl" title={<span style={{ fontFamily: 'var(--font-mono)' }}>{t('Редагування SEO сторінки')}</span>} onClose={closePageEditor}>
        <form onSubmit={handleSavePage}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
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
              <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} type="submit">
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
              <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
                {formError}
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput
                label={t('Прізвище')}
                maxLength={80}
                value={contactFormValues.LastName}
                onChange={(event) => setContactField('LastName', event.currentTarget.value)}
              />
              <TextInput
                label={t('Імʼя')}
                maxLength={80}
                value={contactFormValues.FirstName}
                onChange={(event) => setContactField('FirstName', event.currentTarget.value)}
              />
              <TextInput
                label={t('По батькові')}
                maxLength={80}
                value={contactFormValues.MiddleName}
                onChange={(event) => setContactField('MiddleName', event.currentTarget.value)}
              />
            </SimpleGrid>
            <Group align="end" gap="sm" wrap="nowrap" className="clients-filter-row">
              <Avatar color="gray" name={getSeoContactDisplayName(contactFormValues) || undefined} radius="md" size={72} src={contactFormValues.ImgUrl || undefined}>
                {getContactInitials(contactFormValues)}
              </Avatar>
              <FileInput
                accept="image/*"
                clearable
                disabled={isSaving || isImageUploading}
                label={t('Фото')}
                leftSection={<Image size={16} />}
                placeholder={t('Обрати файл')}
                style={{ flex: '1 1 auto' }}
                onChange={handleContactImageChange}
              />
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput
                label={t('Телефон')}
                maxLength={30}
                value={contactFormValues.Phone}
                onChange={(event) => setContactField('Phone', event.currentTarget.value)}
              />
              <TextInput
                label="E-mail"
                maxLength={150}
                value={contactFormValues.Email}
                onChange={(event) => setContactField('Email', event.currentTarget.value)}
              />
            </SimpleGrid>
            <Group justify="flex-end" gap="sm">
              <Button color="gray" disabled={isSaving || isImageUploading} type="button" variant="light" onClick={closeContactEditor}>
                {t('Скасувати')}
              </Button>
              <Button
                color={CREATE_ACTION_COLOR}
                disabled={isImageUploading}
                leftSection={<Save size={16} />}
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
            {t('Видалити контакт')} <Text span fw={600}>{displayValue(getSeoContactDisplayName(removeContactTarget))}</Text>?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button color="gray" disabled={isSaving} variant="light" onClick={() => setRemoveContactTarget(null)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<Trash2 size={16} />} loading={isSaving} onClick={handleRemoveContact}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>

      <AppModal centered opened={Boolean(priorityStorageTarget)} title={t('Пріоритет складу')} onClose={closePriorityEditor}>
        <form onSubmit={handleSaveStoragePriority}>
          <Stack gap="md">
            {formError && (
              <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
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
              <Button color={CREATE_ACTION_COLOR} leftSection={<Save size={16} />} loading={isSaving} type="submit">
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
            <Button color="red" leftSection={<Trash2 size={16} />} loading={isSaving} onClick={handleRemoveStorage}>
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

          <SeoRosterTable
            columns={allStorageColumns}
            columnsTemplate="minmax(360px, 1fr) 118px 100px 64px"
            data={availableStorages}
            emptyText={t('Складів не знайдено')}
            getRowId={(storage, index) => String(storage.NetUid || storage.Id || index)}
            isLoading={isStoragesLoading}
            loadingText={t('Завантаження складів')}
            maxHeight="calc(100vh - 220px)"
            minWidth={642}
            onRowClick={(storage) => void handleAddStorage(storage)}
          />
        </Stack>
      </AppDrawer>
    </Stack>
  )
}

function SeoShopDataSection({
  action,
  children,
  className,
  count,
  hideCount,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  className?: string
  count: number
  hideCount?: boolean
  title: ReactNode
}) {
  return (
    <section className={['seo-shop-data-section', className].filter(Boolean).join(' ')}>
      <div className="seo-shop-data-section-header">
        <div className="seo-shop-data-section-title">
          <span className="seo-shop-data-section-copy">
            <Text className="seo-shop-data-section-name">{title}</Text>
          </span>
        </div>

        <div className="seo-shop-data-section-meta">
          {!hideCount ? <Text className="seo-shop-data-section-count">{count}</Text> : null}
          {action ? <div className="seo-shop-data-section-actions">{action}</div> : null}
        </div>
      </div>

      <div className="seo-shop-data-section-body">{children}</div>
    </section>
  )
}

function SeoShopClientList({
  clients,
  emptyText,
  isLoading,
  loadingText,
  maxHeight,
  onToggleClient,
}: {
  clients: OnlineShopClient[]
  emptyText: ReactNode
  isLoading?: boolean
  loadingText: ReactNode
  maxHeight?: string
  onToggleClient: (client: OnlineShopClient) => Promise<void>
}) {
  return (
    <div className="seo-shop-data-list">
      <ScrollArea.Autosize mah={maxHeight} type="auto">
        <div className="seo-shop-data-list-body is-client-tiles">
          {isLoading ? (
            <div className="seo-shop-data-list-empty">{loadingText}</div>
          ) : clients.length ? (
            clients.map((client, index) => {
              const clientKey = String(client.NetUid || client.Id || index)
              const isForRetail = Boolean(client.IsForRetail)
              const clientName = displayValue(client.FullName || getClientDisplayName(client))
              const agreementName = getOnlineShopClientAgreementName(client)
              const agreementOrganizationName = getOnlineShopClientAgreementOrganizationName(client)

              return (
                <div
                  className={`seo-shop-data-list-item is-client${isForRetail ? ' is-active' : ' is-inactive'}`}
                  key={clientKey}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if (isSeoActionCellEventTarget(event.target)) {
                      return
                    }

                    void onToggleClient(client)
                  }}
                  onKeyDown={(event) => {
                    if (isSeoActionCellEventTarget(event.target)) {
                      return
                    }

                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void onToggleClient(client)
                    }
                  }}
                >
                  <div className="seo-shop-client-tile-copy">
                    <div className="seo-shop-client-tile-top">
                      <span className="seo-shop-client-tile-avatar" aria-hidden>
                        <ShoppingBasket size={21} />
                      </span>
                      <div className="seo-shop-client-tile-heading">
                        <Text className="seo-shop-client-tile-title">{clientName}</Text>
                        <SeoTableStatusPill active={isForRetail} activeLabel="Активний" inactiveLabel="Не активний" />
                      </div>
                    </div>

                    <div className="seo-shop-client-tile-body">
                      <div className="seo-shop-client-tile-details">
                        <div className="seo-shop-client-tile-detail">
                          <span className="seo-shop-client-tile-detail-label">
                            <FileText size={12} />
                            <span>Договір</span>
                          </span>
                          <span className="seo-shop-client-tile-detail-value">{agreementName || 'Не вказано'}</span>
                        </div>
                        <div className="seo-shop-client-tile-detail">
                          <span className="seo-shop-client-tile-detail-label">
                            <Building size={12} />
                            <span>Організація</span>
                          </span>
                          <span className="seo-shop-client-tile-detail-value">{agreementOrganizationName || 'Не вказано'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <span className={`seo-shop-client-tile-action${isForRetail ? ' is-active' : ' is-inactive'}`} aria-hidden>
                    {isForRetail ? <Check size={16} /> : <X size={16} />}
                  </span>
                </div>
              )
            })
          ) : (
            <div className="seo-shop-data-list-empty">{emptyText}</div>
          )}
        </div>
      </ScrollArea.Autosize>
    </div>
  )
}

function SeoShopCardList({
  cards,
  emptyText,
  isLoading,
  loadingText,
  maxHeight,
  onSelectCard,
}: {
  cards: OnlineShopPaymentRegister[]
  emptyText: ReactNode
  isLoading?: boolean
  isSaving: boolean
  loadingText: ReactNode
  maxHeight?: string
  onSelectCard: (register: OnlineShopPaymentRegister) => Promise<void>
}) {
  return (
    <div className="seo-shop-data-list">
      <ScrollArea.Autosize mah={maxHeight} type="auto">
        <div className="seo-shop-data-list-body is-bank-card-tiles">
          {isLoading ? (
            <div className="seo-shop-data-list-empty">{loadingText}</div>
          ) : cards.length ? (
            cards.map((register, index) => {
              const registerKey = String(register.NetUid || register.Id || index)
              const isSelected = Boolean(register.IsSelected)
              const cardBrand = getPaymentCardBrand(register)
              const organizationName = displayValue(getCompactOrganizationName(register.Organization))

              return (
                <div
                  className={`seo-shop-data-list-item is-bank-card is-${cardBrand}${isSelected ? ' is-active' : ''}`}
                  key={registerKey}
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    if (isSeoActionCellEventTarget(event.target)) {
                      return
                    }

                    void onSelectCard(register)
                  }}
                  onKeyDown={(event) => {
                    if (isSeoActionCellEventTarget(event.target)) {
                      return
                    }

                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void onSelectCard(register)
                    }
                  }}
                >
                  <div className="seo-shop-bank-card-surface">
                    <div className="seo-shop-bank-card-top">
                      <span className="seo-shop-bank-card-chip" aria-hidden>
                        <CreditCard size={16} />
                      </span>
                      <span className={`seo-shop-bank-card-brand is-${cardBrand}`}>
                        <span className="seo-shop-bank-card-brand-mark" aria-hidden />
                        {getPaymentCardBrandLabel(cardBrand)}
                      </span>
                    </div>

                    <Text className="seo-shop-bank-card-number">
                      {displayValue(getMaskedPaymentRegisterNumber(register))}
                    </Text>

                    <div className="seo-shop-bank-card-bottom">
                      <Text className="seo-shop-bank-card-organization">{organizationName}</Text>
                      <span className="seo-shop-bank-card-badges">
                        <span className={`seo-shop-bank-card-state${isSelected ? ' is-active' : ' is-inactive'}`}>
                          {isSelected ? 'Вибрана' : 'Не вибрана'}
                        </span>
                        <span className="seo-shop-bank-card-currency">
                          {displayValue(getPaymentRegisterCurrency(register))}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="seo-shop-data-list-empty">{emptyText}</div>
          )}
        </div>
      </ScrollArea.Autosize>
    </div>
  )
}

function SeoRosterTable<TData>({
  columns,
  columnsTemplate,
  data,
  emptyText,
  fillHeight = false,
  getRowClassName,
  getRowId,
  isLoading,
  loadingText,
  maxHeight,
  minWidth,
  onRowClick,
}: {
  columns: SeoRosterColumn<TData>[]
  columnsTemplate: string
  data: TData[]
  emptyText: ReactNode
  fillHeight?: boolean
  getRowClassName?: (row: TData, index: number) => string | undefined
  getRowId: (row: TData, index: number) => string
  isLoading?: boolean
  loadingText: ReactNode
  maxHeight?: string
  minWidth: number
  onRowClick?: (row: TData) => void
}) {
  const tableStyle = {
    '--seo-roster-columns': columnsTemplate,
    '--seo-roster-min-width': `${minWidth}px`,
  } as CSSProperties

  return (
    <div className={`seo-roster-table${fillHeight ? ' is-fill-height' : ''}`} style={tableStyle}>
      <div className="seo-roster-head">
        {columns.map((column) => (
          <span className={`seo-roster-head-cell is-${column.id}`} key={column.id}>
            {column.header}
          </span>
        ))}
      </div>

      <ScrollArea.Autosize
        className={fillHeight ? 'seo-roster-scroll is-fill-height' : undefined}
        h={fillHeight ? '100%' : undefined}
        mah={fillHeight ? undefined : maxHeight}
        type="auto"
      >
        <div className="seo-roster-body">
          {isLoading ? (
            <div className="seo-roster-empty">{loadingText}</div>
          ) : data.length ? (
            data.map((row, index) => {
              const rowClassName = getRowClassName?.(row, index)
              const rowId = getRowId(row, index)
              const rowClassNames = [
                'seo-roster-row',
                rowClassName,
                onRowClick ? 'is-clickable' : undefined,
              ].filter(Boolean).join(' ')
              const rowCells = columns.map((column) => (
                <div className={`seo-roster-cell is-${column.id}`} key={column.id}>
                  {column.cell ? column.cell(row) : displayValue(column.accessor?.(row))}
                </div>
              ))

              if (onRowClick) {
                return (
                  <div className="seo-roster-row-frame" key={rowId}>
                    <div
                      className={rowClassNames}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        if (isSeoActionCellEventTarget(event.target)) {
                          return
                        }

                        onRowClick(row)
                      }}
                      onKeyDown={(event) => {
                        if (isSeoActionCellEventTarget(event.target)) {
                          return
                        }

                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onRowClick(row)
                        }
                      }}
                    >
                      {rowCells}
                    </div>
                  </div>
                )
              }

              return (
                <div className="seo-roster-row-frame" key={rowId}>
                  <div className={rowClassNames}>{rowCells}</div>
                </div>
              )
            })
          ) : (
            <div className="seo-roster-empty">{emptyText}</div>
          )}
        </div>
      </ScrollArea.Autosize>
    </div>
  )
}

function SeoTablePrimaryCell({
  avatar,
  subtitle,
  title,
}: {
  avatar?: ReactNode
  subtitle?: ReactNode
  title: ReactNode
}) {
  return (
    <div className="seo-table-primary-cell">
      {avatar}
      <span className="seo-table-primary-copy">
        <Text className="seo-table-primary-title">{title}</Text>
        {subtitle ? (
          <Text className="seo-table-primary-subtitle">{subtitle}</Text>
        ) : null}
      </span>
    </div>
  )
}

function SeoTableContactProfileCell({ contact }: { contact: SeoContact }) {
  const contactName = getSeoContactDisplayName(contact)

  return (
    <div className="seo-table-contact-profile-cell">
      <Avatar className="seo-table-avatar" name={contactName || undefined} radius="xl" src={contact.ImgUrl || undefined}>
        {getContactInitials(contact)}
      </Avatar>
      <span className="seo-table-contact-profile-copy">
        <Text className="seo-table-contact-last-name">{displayValue(contact.LastName || contactName)}</Text>
        <Text className="seo-table-contact-first-name">{getSeoContactGivenName(contact)}</Text>
      </span>
    </div>
  )
}

function SeoTableTextCell({ primary }: { primary: ReactNode }) {
  return (
    <span className="seo-table-text-cell">
      <Text className="seo-table-text-primary">{primary}</Text>
    </span>
  )
}

function SeoTableDateCell({ value }: { value?: Date | string }) {
  const formattedValue = formatDateTime(value)
  const [datePart, timePart] = formattedValue.split(',').map((part) => part.trim())

  return (
    <span className="seo-table-date-cell">
      <Text className="seo-table-date-primary">{displayValue(datePart)}</Text>
      {timePart ? (
        <Text className="seo-table-date-secondary">{timePart}</Text>
      ) : null}
    </span>
  )
}

function SeoTableStorageCell({ storage }: { storage: OnlineShopStorage }) {
  return (
    <SeoTablePrimaryCell
      subtitle={displayValue(getCompactOrganizationName(storage.Organization))}
      title={displayValue(storage.Name)}
    />
  )
}

function SeoTableMutedCell({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'date' | 'default' | 'strong' | 'url'
}) {
  return <span className={`seo-table-muted-cell is-${tone}`}>{children}</span>
}

function SeoTableRoleLikeCell({
  children,
  icon,
  tone = 'default',
}: {
  children: ReactNode
  icon: ReactNode
  tone?: 'date' | 'default' | 'url'
}) {
  return (
    <span className="seo-table-role-like-cell">
      <span className="seo-table-role-like-icon" aria-hidden>
        {icon}
      </span>
      <SeoTableMutedCell tone={tone}>{children}</SeoTableMutedCell>
    </span>
  )
}

function SeoTableTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'accent' | 'locale' | 'neutral' }) {
  return <span className={`seo-table-tag is-${tone}`}>{children}</span>
}

function SeoTableLocaleTag({ children }: { children: ReactNode }) {
  return <SeoTableTag tone="locale">{children}</SeoTableTag>
}

function SeoTableStatusPill({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean
  activeLabel: TranslationKey
  inactiveLabel: TranslationKey
}) {
  const { t } = useI18n()

  return (
    <span className={`seo-table-status-pill ${active ? 'is-active' : 'is-inactive'}`}>
      {active ? t(activeLabel) : t(inactiveLabel)}
    </span>
  )
}

function SeoTableActionCell({ children }: { children: ReactNode }) {
  return (
    <div className="seo-table-action-cell">
      {children}
    </div>
  )
}

function isSeoActionCellEventTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.seo-table-action-cell'))
}

function getOrderedSeoGeneralEntries(entries: SeoLocaleEntry[]) {
  const localeOrder = new Map<string, number>([
    ['uk', 0],
    ['ua', 0],
    ['ru', 1],
  ])

  return entries.toSorted((leftEntry, rightEntry) => {
    const leftLocale = leftEntry.locale.toLowerCase()
    const rightLocale = rightEntry.locale.toLowerCase()
    const leftOrder = localeOrder.get(leftLocale) ?? 10
    const rightOrder = localeOrder.get(rightLocale) ?? 10

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return leftLocale.localeCompare(rightLocale)
  })
}

function getSeoGeneralMatrixValue(entry: SeoLocaleEntry, field: SeoGeneralMatrixField) {
  if (field.group === 'contact') {
    const record = entry.settings.EcommerceContactInfo as Partial<Record<SeoGeneralContactFieldId, string>> | null | undefined

    return record?.[field.id] || ''
  }

  const record = entry.settings.RetailPaymentTypeTranslate as Partial<Record<SeoGeneralPaymentFieldId, string>> | null | undefined

  return record?.[field.id] || ''
}

function isSeoGeneralMatrixFieldEditable(entry: SeoLocaleEntry, field: SeoGeneralMatrixField) {
  return field.group === 'contact' || hasPaymentRecord(entry.settings.RetailPaymentTypeTranslate)
}

function isSeoTabSlug(slug: string | undefined): slug is SeoTab {
  return Boolean(slug && SEO_TAB_VALUES.has(slug as SeoTab))
}

function getSeoTabFromSlug(slug: string | undefined): SeoTab {
  if (slug === 'contact-info' || slug === 'payment') {
    return 'info-payment'
  }

  return isSeoTabSlug(slug) ? slug : DEFAULT_SEO_TAB
}

function getSeoTabHref(tab: SeoTab) {
  return `/online-shop-seo/${tab}`
}

type SeoCommandSearchConfig = {
  filterLabel?: TranslationKey
  filterOptions?: Array<{ value: string; label: TranslationKey }>
  filterValue?: string
  label: TranslationKey
  placeholder: TranslationKey
  value: string
  onChange: (value: string) => void
  onFilterChange?: (value: string) => void
  onReset: () => void
}

type SeoCommandSearchState = {
  cardSearchDraft: string
  changeCardSearch: (value: string) => void
  changeClientSearch: (value: string) => void
  changeContactSearch: (value: string) => void
  changePageSearch: (value: string) => void
  changeShopDataSearch: (value: string) => void
  changeStorageSearch: (value: string) => void
  clientSearchDraft: string
  contactSearchDraft: string
  pageSearchDraft: string
  resetCardSearch: () => void
  resetClientSearch: () => void
  resetContactSearch: () => void
  resetPageSearch: () => void
  resetShopDataSearch: () => void
  resetStorageSearch: () => void
  setShopDataSearchTarget: (value: SeoShopDataSearchTarget) => void
  shopDataSearchDraft: string
  shopDataSearchTarget: SeoShopDataSearchTarget
  storageSearchDraft: string
}

type SeoTabLoadingState = {
  isCardsLoading: boolean
  isClientsLoading: boolean
  isLoading: boolean
  isStoragesLoading: boolean
}

function getSeoTabLoadingState(activeTab: SeoTab, state: SeoTabLoadingState) {
  switch (activeTab) {
    case 'shop-clients':
      return state.isClientsLoading
    case 'bank-cards':
      return state.isCardsLoading
    case 'warehouses':
      return state.isStoragesLoading
    case 'shop-data':
      return state.isClientsLoading || state.isCardsLoading || state.isStoragesLoading
    case 'pages':
    case 'contacts':
    case 'info-payment':
    default:
      return state.isLoading
  }
}

function getSeoCommandSearchConfig(
  activeTab: SeoTab,
  state: SeoCommandSearchState,
): SeoCommandSearchConfig | null {
  switch (activeTab) {
    case 'pages':
      return {
        label: 'Пошук',
        placeholder: 'Назва, URL або текст',
        value: state.pageSearchDraft,
        onChange: state.changePageSearch,
        onReset: state.resetPageSearch,
      }
    case 'contacts':
      return {
        label: 'Пошук',
        placeholder: 'Імʼя, телефон або e-mail',
        value: state.contactSearchDraft,
        onChange: state.changeContactSearch,
        onReset: state.resetContactSearch,
      }
    case 'shop-clients':
      return {
        label: 'Пошук',
        placeholder: 'Назва, телефон або e-mail',
        value: state.clientSearchDraft,
        onChange: state.changeClientSearch,
        onReset: state.resetClientSearch,
      }
    case 'bank-cards':
      return {
        label: 'Пошук',
        placeholder: 'Рахунок, назва, банк або організація',
        value: state.cardSearchDraft,
        onChange: state.changeCardSearch,
        onReset: state.resetCardSearch,
      }
    case 'warehouses':
      return {
        label: 'Пошук',
        placeholder: 'Назва або організація',
        value: state.storageSearchDraft,
        onChange: state.changeStorageSearch,
        onReset: state.resetStorageSearch,
      }
    case 'shop-data':
      return {
        filterLabel: 'Шукати по',
        filterOptions: SEO_SHOP_DATA_SEARCH_TARGET_OPTIONS,
        filterValue: state.shopDataSearchTarget,
        label: 'Пошук',
        placeholder: SEO_SHOP_DATA_SEARCH_PLACEHOLDERS[state.shopDataSearchTarget],
        value: state.shopDataSearchDraft,
        onChange: state.changeShopDataSearch,
        onFilterChange: (value) => state.setShopDataSearchTarget(value as SeoShopDataSearchTarget),
        onReset: state.resetShopDataSearch,
      }
    case 'info-payment':
      return null
    default:
      return null
  }
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
    [getSeoContactDisplayName(contact), contact.FirstName, contact.LastName, contact.MiddleName, contact.Phone, contact.Email, contact.NetUid]
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
  const name = getSeoContactDisplayName(contact)

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

function getSeoContactGivenName(contact: SeoContact) {
  const givenName = [contact.FirstName, contact.MiddleName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')

  return displayValue(givenName)
}

function getClientInitials(client: OnlineShopClient) {
  const name = getClientDisplayName(client).trim()

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

function getOnlineShopClientAgreementName(client: OnlineShopClient) {
  return (
    getOnlineShopClientAgreementCandidateName(client.ClientAgreement) ||
    client.Agreement?.Name ||
    client.AgreementName ||
    (client.ClientAgreements || []).map(getOnlineShopClientAgreementCandidateName).find(Boolean) ||
    ''
  )
}

function getOnlineShopClientAgreementCandidateName(agreement?: OnlineShopClient['ClientAgreement']) {
  return agreement?.Agreement?.Name || agreement?.AgreementName || agreement?.Name || ''
}

function getOnlineShopClientAgreementOrganizationName(client: OnlineShopClient) {
  return (
    getOnlineShopClientAgreementCandidateOrganizationName(client.ClientAgreement) ||
    getCompactOrganizationName(client.Agreement?.Organization) ||
    (client.ClientAgreements || []).map(getOnlineShopClientAgreementCandidateOrganizationName).find(Boolean) ||
    ''
  )
}

function getOnlineShopClientAgreementCandidateOrganizationName(agreement?: OnlineShopClient['ClientAgreement']) {
  return getCompactOrganizationName(agreement?.Agreement?.Organization || agreement?.Organization || null)
}

function filterOnlineShopClients(clients: OnlineShopClient[], searchValue: string) {
  const normalizedSearch = searchValue.trim().toLowerCase()

  if (!normalizedSearch) {
    return clients
  }

  return clients.filter((client) =>
    [
      getClientDisplayName(client),
      getOnlineShopClientAgreementName(client),
      getOnlineShopClientAgreementOrganizationName(client),
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

function getPaymentRegisterNumber(register: OnlineShopPaymentRegister) {
  return register.AccountNumber || register.Name || register.IBAN || ''
}

function getMaskedPaymentRegisterNumber(register: OnlineShopPaymentRegister) {
  return maskPaymentCardNumber(getPaymentRegisterNumber(register))
}

function maskPaymentCardNumber(value: string) {
  const trimmedValue = value.trim()
  const digits = trimmedValue.replace(/\D/g, '')

  if (digits.length < 8) {
    return trimmedValue
  }

  const maskedNumber = `${digits.slice(0, 4)}${'*'.repeat(digits.length - 8)}${digits.slice(-4)}`

  return maskedNumber.replace(/(.{4})/g, '$1 ').trim()
}

function getPaymentCardBrand(register: OnlineShopPaymentRegister): PaymentCardBrand {
  const digits = getPaymentRegisterNumber(register).replace(/\D/g, '')
  const firstTwo = Number(digits.slice(0, 2))
  const firstFour = Number(digits.slice(0, 4))

  if (digits.startsWith('4')) {
    return 'visa'
  }

  if ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720)) {
    return 'mastercard'
  }

  return 'unknown'
}

function getPaymentCardBrandLabel(brand: PaymentCardBrand) {
  switch (brand) {
    case 'mastercard':
      return 'Mastercard'
    case 'visa':
      return 'Visa'
    default:
      return 'Card'
  }
}

function getOrganizationName(organization?: OnlineShopPaymentRegister['Organization'] | OnlineShopStorage['Organization']) {
  return organization?.FullName || organization?.Name || organization?.Abbreviation || ''
}

function getCompactOrganizationName(organization?: OnlineShopPaymentRegister['Organization'] | OnlineShopStorage['Organization']) {
  return organization?.Abbreviation || organization?.Name || organization?.FullName || ''
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
