import { ActionIcon, Anchor, Button, Group, Loader, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Copy, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal, AppModalFooter } from '../../../shared/ui/AppModal'
import { TableChip } from '../../../shared/ui/TableChip'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { TableRowAction } from '../../../shared/ui/table-row-action'
import { ProductCardModal } from '../../products/components/ProductCardModal'
import { usePermissions } from '../../auth/usePermissions'
import { usePersistentCreateMutation } from '../../sales-ukraine/persistentCreateMutation'
import {
  createOffer,
  getOfferProductAvailableQtyUk,
  getOfferSubClients,
  getOffersClientAgreements,
  getPublicOfferLink,
  searchOffersClients,
  searchOffersProducts,
} from '../api/salesOffersApi'
import type {
  ClientShoppingCart,
  OfferClientAgreement,
  OfferSubClientLink,
  OffersClientOption,
  OffersNewLine,
  OffersProduct,
} from '../types'
import './offers-modal.css'

const OFFER_SELECT_PROPS = {
  classNames: {
    dropdown: 'offers-create-select-dropdown',
    option: 'offers-create-select-option',
    empty: 'offers-create-select-empty',
  },
  maxDropdownHeight: 220,
  size: 'xs' as const,
}

export function NewOfferModal({
  onClose,
  onCreated,
  opened,
}: {
  onClose: () => void
  onCreated: () => void
  opened: boolean
}) {
  const { t } = useI18n()
  const { can } = usePermissions()
  const isOpen = can(PermissionKeys.SalesUkraineOffers.Offer.Create) && opened
  const [created, setCreated] = useState<ClientShoppingCart | null>(null)

  function close() {
    setCreated(null)
    onClose()
  }

  function done() {
    setCreated(null)
    onCreated()
  }

  return (
    <AppModal
      centered
      className="offers-modal offers-create-modal"
      opened={isOpen}
      size="lg"
      title={<span className="offers-modal__title">{created ? t('Пропозицію створено') : t('Створити пропозицію')}</span>}
      onClose={close}
    >
      {isOpen
        && (created ? (
          <OfferGeneratedLink offer={created} onDone={done} />
        ) : (
          <NewOfferForm onCancel={close} onCreated={setCreated} />
        ))}
    </AppModal>
  )
}

function OfferGeneratedLink({ offer, onDone }: { offer: ClientShoppingCart; onDone: () => void }) {
  const { t } = useI18n()
  const link = offer.NetUid ? getPublicOfferLink(offer.NetUid) : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      notifications.show({ color: 'green', message: t('Посилання скопійовано') })
    } catch {
      notifications.show({ color: 'red', message: t('Не вдалося скопіювати посилання') })
    }
  }

  return (
    <Stack gap={10}>
      <Text className="offers-modal-generated-title">
        {t('Пропозиція')} {offer.Number ?? ''}
      </Text>
      <Group align="flex-end" gap="xs" wrap="nowrap">
        <TextInput readOnly label={t('Посилання')} style={{ flex: 1 }} value={link} />
        <ActionIcon aria-label={t('Копіювати посилання')} size="lg" variant="light" onClick={copy}>
          <Copy size={18} />
        </ActionIcon>
      </Group>
      <AppModalFooter>
        <Button color={CREATE_ACTION_COLOR} onClick={onDone}>{t('Готово')}</Button>
      </AppModalFooter>
    </Stack>
  )
}

function NewOfferForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (offer: ClientShoppingCart) => void
}) {
  const { t } = useI18n()
  const { can } = usePermissions()
  const [clientQuery, setClientQuery] = useState('')
  const [clientOptions, setClientOptions] = useState<OffersClientOption[]>([])
  const [clientNetId, setClientNetId] = useState<string | null>(null)
  const [subClients, setSubClients] = useState<OfferSubClientLink[]>([])
  const [subClientNetId, setSubClientNetId] = useState<string | null>(null)
  const [isLoadingSubClients, setLoadingSubClients] = useState(false)
  const [agreements, setAgreements] = useState<OfferClientAgreement[]>([])
  const [agreementNetId, setAgreementNetId] = useState<string | null>(null)
  const [isLoadingAgreements, setLoadingAgreements] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [productOptions, setProductOptions] = useState<OffersProduct[]>([])
  const [lines, setLines] = useState<OffersNewLine[]>([])
  const [isCreating, setCreating] = useState(false)
  const [productCardNetId, setProductCardNetId] = useState<string | null>(null)
  const runCreateOffer = usePersistentCreateMutation('offer', 'new')

  useEffect(() => {
    const value = clientQuery.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchOffersClients(value)

        if (!cancelled) {
          setClientOptions(next)
        }
      } catch {
        if (!cancelled) {
          setClientOptions([])
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [clientQuery])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoadingSubClients(true)

      try {
        const next = await getOfferSubClients(id)

        if (!cancelled) {
          setSubClients(next)
        }
      } catch {
        if (!cancelled) {
          setSubClients([])
        }
      } finally {
        if (!cancelled) {
          setLoadingSubClients(false)
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId])

  useEffect(() => {
    const effectiveClientNetId = subClientNetId ?? clientNetId

    if (!effectiveClientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      setLoadingAgreements(true)

      try {
        const next = await getOffersClientAgreements(id)

        if (!cancelled) {
          setAgreements(next)
        }
      } catch {
        if (!cancelled) {
          setAgreements([])
        }
      } finally {
        if (!cancelled) {
          setLoadingAgreements(false)
        }
      }
    }

    void load(effectiveClientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId, subClientNetId])

  useEffect(() => {
    const value = productQuery.trim()

    if (value.length < 2) {
      return
    }

    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const next = await searchOffersProducts(value)

        if (!cancelled) {
          setProductOptions(next)
        }
      } catch {
        if (!cancelled) {
          setProductOptions([])
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [productQuery])

  const clientData = clientOptions.reduce<{ label: string; value: string }[]>((acc, client) => {
    if (client.NetUid) {
      acc.push({ label: getClientLabel(client), value: client.NetUid ?? '' })
    }

    return acc
  }, [])
  const subClientData = subClients
    .map((link) => link.SubClient)
    .filter((sub): sub is OffersClientOption => Boolean(sub?.NetUid) && Boolean(sub?.IsSubClient || sub?.IsTradePoint))
    .map((sub) => ({ label: getClientLabel(sub), value: sub.NetUid ?? '' }))
  const agreementData = agreements.reduce<{ label: string; value: string }[]>((acc, item) => {
    if (item.NetUid) {
      acc.push({ label: item.Agreement?.Name ?? item.NetUid ?? '', value: item.NetUid ?? '' })
    }

    return acc
  }, [])
  const productData = productOptions.reduce<{ label: string; value: string }[]>((acc, product) => {
    if (product.NetUid) {
      acc.push({ label: getProductLabel(product), value: product.NetUid ?? '' })
    }

    return acc
  }, [])

  async function addProduct(netUid: string | null) {
    if (!netUid || !agreementNetId) {
      return
    }

    const product = productOptions.find((item) => item.NetUid === netUid)

    if (!product) {
      return
    }

    if (lines.some((line) => line.product.NetUid === netUid)) {
      setProductQuery('')

      return
    }

    const availableQtyUk = await getOfferProductAvailableQtyUk(netUid, agreementNetId).catch(() => 0)

    if (availableQtyUk === 0) {
      notifications.show({ color: 'red', message: t('Немає товарів на складі') })
      setProductQuery('')

      return
    }

    setLines((current) => {
      if (current.some((line) => line.product.NetUid === netUid)) {
        return current
      }

      return [...current, { comment: '', key: netUid, product, qty: 1 }]
    })
    setProductQuery('')
  }

  function updateLineQty(key: string, qty: number) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, qty } : line)))
  }

  function updateLineComment(key: string, comment: string) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, comment } : line)))
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key))
  }

  async function create() {
    if (!can(PermissionKeys.SalesUkraineOffers.Offer.Create)) {
      return
    }

    const agreement = agreements.find((item) => item.NetUid === agreementNetId)

    if (!agreement || lines.length === 0) {
      return
    }

    setCreating(true)

    const offer: ClientShoppingCart = {
      ClientAgreement: agreement,
      OrderItems: lines.map((line) => ({
        Comment: line.comment.trim() || undefined,
        Product: line.product,
        Qty: line.qty,
      })),
    }

    try {
      const result = await runCreateOffer(offer, createOffer)
      notifications.show({ color: 'green', message: t('Пропозицію успішно створено') })

      if (result?.NetUid) {
        onCreated(result)
      } else {
        notifications.show({ color: 'red', message: t('Не вдалося отримати посилання на пропозицію') })
      }
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : t('Не вдалося створити пропозицію'),
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Stack className="offers-modal-form" gap={10}>
      <Select
        {...OFFER_SELECT_PROPS}
        searchable
        data={clientData}
        filter={({ options }) => options}
        label={t('Клієнт')}
        leftSection={<Search size={16} />}
        nothingFoundMessage={clientQuery.trim().length < 2 ? null : t('Нічого не знайдено')}
        placeholder={t('Пошук клієнта — мінімум 2 символи')}
        renderOption={({ option }) => <TableChip tone="warning" value={option.label} />}
        searchValue={clientQuery}
        value={clientNetId}
        onChange={(value) => {
          setClientNetId(value)
          setSubClientNetId(null)
          setSubClients([])
          setAgreementNetId(null)
          setAgreements([])
        }}
        onSearchChange={setClientQuery}
      />

      {subClientData.length > 0 && (
        <Select
          {...OFFER_SELECT_PROPS}
          clearable
          searchable
          data={subClientData}
          disabled={isLoadingSubClients}
          label={t('Суб-клієнт')}
          renderOption={({ option }) => <TableChip tone="warning" value={option.label} />}
          placeholder={t('Без суб-клієнта')}
          value={subClientNetId}
          onChange={(value) => {
            setSubClientNetId(value)
            setAgreementNetId(null)
            setAgreements([])
          }}
        />
      )}

      <Select
        {...OFFER_SELECT_PROPS}
        searchable
        data={agreementData}
        disabled={!clientNetId || isLoadingAgreements}
        label={t('Договір')}
        placeholder={isLoadingAgreements ? t('Завантаження') : t('Оберіть договір')}
        rightSection={isLoadingAgreements ? <Loader size="xs" /> : null}
        value={agreementNetId}
        onChange={setAgreementNetId}
      />

      <Select
        {...OFFER_SELECT_PROPS}
        searchable
        data={productData}
        disabled={!agreementNetId}
        label={t('Товар')}
        leftSection={<Search size={16} />}
        nothingFoundMessage={
          productQuery.trim().length < 2 ? null : t('Нічого не знайдено')
        }
        placeholder={t('Пошук товару — мінімум 2 символи')}
        renderOption={({ option }) => {
          const product = productOptions.find((item) => item.NetUid === option.value)
          return product ? <OfferLineProduct product={product} /> : option.label
        }}
        searchValue={productQuery}
        value={null}
        onChange={(value) => {
          void addProduct(value)
        }}
        onSearchChange={setProductQuery}
      />

      {lines.length > 0 && (
        <div className="offers-create-modal__table-scroll">
        <Table className="app-static-table offers-modal-lines-table" striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Товар')}</Table.Th>
              <Table.Th w={120}>{t('Кількість')}</Table.Th>
              <Table.Th>{t('Коментар')}</Table.Th>
              <Table.Th w={48} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((line) => (
              <Table.Tr key={line.key}>
                <Table.Td>
                  {line.product.NetUid ? (
                    <Anchor
                      className="offers-modal-product-link"
                      component="button"
                      type="button"
                      underline="hover"
                      onClick={(event) => {
                        event.stopPropagation()
                        setProductCardNetId(line.product.NetUid as string)
                      }}
                    >
                      <OfferLineProduct product={line.product} />
                    </Anchor>
                  ) : (
                    <div className="offers-modal-product-name"><OfferLineProduct product={line.product} /></div>
                  )}
                </Table.Td>
                <Table.Td className="app-table-number">
                  <NumberInput
                    aria-label={t('Кількість')}
                    hideControls
                    min={1}
                    value={line.qty}
                    onChange={(value) => updateLineQty(line.key, typeof value === 'number' ? value : 1)}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    aria-label={t('Коментар')}
                    placeholder={t('Коментар')}
                    value={line.comment}
                    onChange={(event) => updateLineComment(line.key, event.currentTarget.value)}
                  />
                </Table.Td>
                <Table.Td>
                  <TableRowAction action="delete" label={t('Видалити')} onClick={() => removeLine(line.key)} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </div>
      )}

      {agreementNetId && lines.length === 0 && (
        <Text c="dimmed" size="sm">
          {t('Додайте товари до пропозиції')}
        </Text>
      )}

      <AppModalFooter>
        <Button disabled={isCreating} variant="default" onClick={onCancel}>
          {t('Скасувати')}
        </Button>
        <Button color={CREATE_ACTION_COLOR} disabled={!agreementNetId || lines.length === 0} loading={isCreating} onClick={create}>
          {t('Створити')}
        </Button>
      </AppModalFooter>
      <ProductCardModal productNetId={productCardNetId} onClose={() => setProductCardNetId(null)} />
    </Stack>
  )
}

function OfferLineProduct({ product }: { product: OffersProduct }) {
  return (
    <span className="offers-create-modal__product">
      <span className="offers-create-modal__product-codes">
        <TableChip tone="product" value={product.VendorCode} />
        <TableChip tone="warning" value={product.MainOriginalNumber} />
      </span>
      <span>{product.Name || product.NetUid}</span>
    </span>
  )
}

function getClientLabel(client: OffersClientOption): string {
  return (
    client.FullName?.trim()
    || [client.LastName, client.FirstName, client.MiddleName].filter(Boolean).join(' ').trim()
    || client.Name?.trim()
    || client.NetUid
    || ''
  )
}

function getProductLabel(product: OffersProduct): string {
  return (
    [product.VendorCode, product.MainOriginalNumber, product.Name].filter(Boolean).join(' ').trim()
    || product.NetUid
    || ''
  )
}
