import { notifications } from '@mantine/notifications'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getSaleTransporterTypes, getSaleTransportersByType } from '../../api/salesUkraineApi'
import type { SalesUkraineSale, SalesUkraineTransporter } from '../../types'
import type { WizardReviewComboboxOption } from './WizardReviewCombobox'
import {
  getClientDeliveryRecipients,
  newDeliveryRecipient,
  newDeliveryRecipientAddress,
  type WizardDeliveryRecipient,
  type WizardDeliveryRecipientAddress,
} from './newSaleWizardApi'
import { isSelfCheckout, type NewSaleReviewValue } from './newSaleWizardState'

const NO_RECIPIENTS: WizardDeliveryRecipient[] = []
const NO_TRANSPORTERS: SalesUkraineTransporter[] = []
const NO_ADDRESSES: WizardDeliveryRecipientAddress[] = []

type WizardDeliveryDetailsOptions = {
  clientNetId: string | null
  sale: SalesUkraineSale | null
  value: NewSaleReviewValue
  onChange: (patch: Partial<NewSaleReviewValue>) => void
  submitFlow: 'create' | 'edit'
}

export function useWizardDeliveryDetails({ clientNetId, sale, value, onChange, submitFlow }: WizardDeliveryDetailsOptions) {
  const { t } = useI18n()
  const [transporterData, setTransporterData] = useState<{ flow: string; items: SalesUkraineTransporter[] } | null>(null)
  const [recipientData, setRecipientData] = useState<{ clientNetId: string | null; items: WizardDeliveryRecipient[] } | null>(null)
  const transporters = transporterData?.flow === submitFlow ? transporterData.items : NO_TRANSPORTERS
  const recipients = recipientData?.clientNetId === clientNetId ? recipientData.items : NO_RECIPIENTS
  const context = JSON.stringify([clientNetId, sale?.NetUid ?? sale?.Id ?? null])
  const generationRef = useRef(0)
  const recipientCreationRef = useRef<symbol | null>(null)
  const addressCreationRef = useRef<symbol | null>(null)
  const transporterSeededRef = useRef(false)
  const recipientSeededRef = useRef(false)
  const flagsSeededRef = useRef(false)
  const latestRef = useRef({ onChange, sale, value })
  useLayoutEffect(() => { latestRef.current = { onChange, sale, value } })

  useLayoutEffect(() => {
    transporterSeededRef.current = false
    recipientSeededRef.current = false
    flagsSeededRef.current = false
  }, [context])

  // Requests may finish after another sale or recipient is selected. Invalidate
  // their UI updates, including when a selection changes away and back again.
  useLayoutEffect(() => {
    generationRef.current += 1
    recipientCreationRef.current = null
    addressCreationRef.current = null
    return () => { generationRef.current += 1 }
  }, [context, value.recipient?.Id, value.recipient?.NetUid])

  useEffect(() => {
    const { onChange: change, value: current } = latestRef.current

    if (flagsSeededRef.current || !sale) {
      return
    }

    flagsSeededRef.current = true

    const patch: Partial<NewSaleReviewValue> = {}

    if (!current.hasOwnTtn && (sale.CustomersOwnTtnId ?? 0) > 0) {
      patch.hasOwnTtn = true
    }

    if (!current.ttnNumber && sale.CustomersOwnTtn?.Number) {
      patch.ttnNumber = sale.CustomersOwnTtn.Number
    }

    if (!current.isCashOnDelivery && sale.IsCashOnDelivery) {
      patch.isCashOnDelivery = true
    }

    if (current.codAmount === '' && typeof sale.CashOnDeliveryAmount === 'number' && sale.CashOnDeliveryAmount !== 0) {
      patch.codAmount = sale.CashOnDeliveryAmount
    }

    // The editor saves Comment with the delivery data, so it must start from the stored comment
    // (independently of the recipient list), or every delivery edit would erase it.
    if (!current.comment && sale.Comment) {
      patch.comment = sale.Comment
    }

    if (Object.keys(patch).length > 0) {
      change(patch)
    }
  }, [context, sale])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const types = await getSaleTransporterTypes(submitFlow)
        if (cancelled) return
        const firstType = types[0]

        if (!firstType?.NetUid) {
          if (!cancelled) {
            setTransporterData({ flow: submitFlow, items: [] })
          }

          return
        }

        const next = await getSaleTransportersByType(firstType.NetUid)

        if (!cancelled) {
          setTransporterData({ flow: submitFlow, items: next })
        }
      } catch {
        if (!cancelled) {
          setTransporterData({ flow: submitFlow, items: [] })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [submitFlow])

  useEffect(() => {
    const { onChange: change, sale: currentSale, value: current } = latestRef.current

    if (transporterSeededRef.current || transporters.length === 0) {
      return
    }

    transporterSeededRef.current = true

    if (!current.transporter && currentSale?.Transporter?.NetUid) {
      const match = transporters.find((item) => item.NetUid === currentSale.Transporter?.NetUid)

      if (match) {
        change({ transporter: match })
      }
    }
  }, [context, transporters])

  useEffect(() => {
    if (!clientNetId) {
      return
    }

    let cancelled = false

    async function load(id: string) {
      try {
        const next = await getClientDeliveryRecipients(id, submitFlow)

        if (!cancelled) {
          setRecipientData({ clientNetId: id, items: next })
        }
      } catch {
        if (!cancelled) {
          setRecipientData({ clientNetId: id, items: [] })
        }
      }
    }

    void load(clientNetId)

    return () => {
      cancelled = true
    }
  }, [clientNetId, submitFlow])

  useEffect(() => {
    const { onChange: change, sale: currentSale, value: current } = latestRef.current

    if (recipientSeededRef.current || recipients.length === 0) {
      return
    }

    recipientSeededRef.current = true

    if (current.recipient) {
      return
    }

    const patch: Partial<NewSaleReviewValue> = {}
    const saleRecipient = currentSale?.DeliveryRecipient

    if (saleRecipient) {
      const match = recipients.find((item) => item.NetUid === saleRecipient.NetUid)

      if (match) {
        applyRecipientSelection(patch, match, currentSale?.DeliveryRecipientAddress?.NetUid)
      }
    } else if (recipients[0]) {
      applyRecipientSelection(patch, recipients[0], undefined)
    }

    if (Object.keys(patch).length > 0) {
      change(patch)
    }
  }, [context, recipients])

  const selfCheckout = isSelfCheckout(value.transporter)

  const transporterOptions = useMemo<WizardReviewComboboxOption<SalesUkraineTransporter>[]>(() => transporters.map((item, index) => ({
    entity: item,
    key: item.Id != null ? String(item.Id) : `transporter-${index}`,
    label: item.Name ? item.Name : '---',
  })), [transporters])
  const transporterKey = value.transporter?.Id != null ? String(value.transporter.Id) : null

  const syntheticClientId = sale?.ClientAgreement?.Client?.Id
  // Once a real recipient is picked/created (e.g. typed-in new one), show the real list so it is
  // present among the options — otherwise the self-checkout synthetic placeholder hides it and the
  // field looks cleared after creating a recipient.
  const hasSelectedRecipient = (value.recipient?.Id ?? 0) > 0
  // A typed-in recipient stays a local draft until the sale is saved (see commitDraftRecipient).
  const draftRecipient = value.isNewRecipient && value.recipient && !hasSelectedRecipient ? value.recipient : null
  const recipientOptions = useMemo<WizardReviewComboboxOption<WizardDeliveryRecipient>[]>(() => {
    const recipientSource =
      selfCheckout && !hasSelectedRecipient && !draftRecipient && !recipients.some((item) => item.FullName === t('Не вибраний перевізник'))
        ? [{ FullName: '', ...(syntheticClientId ? { ClientId: syntheticClientId } : {}) } as WizardDeliveryRecipient]
        : recipients

    const options = recipientSource.map((item, index) => ({
      entity: item,
      key: item.Id != null ? String(item.Id) : `recipient-${index}`,
      label: item.FullName ? item.FullName : '---',
    }))

    return draftRecipient
      ? [...options, { entity: draftRecipient, key: DRAFT_RECIPIENT_KEY, label: draftRecipient.FullName || '---' }]
      : options
  }, [selfCheckout, hasSelectedRecipient, draftRecipient, recipients, syntheticClientId, t])
  const recipientKey = draftRecipient
    ? DRAFT_RECIPIENT_KEY
    : value.recipient ? (value.recipient.Id != null ? String(value.recipient.Id) : 'recipient-0') : null

  const recipientAddresses = value.recipient?.DeliveryRecipientAddresses ?? NO_ADDRESSES
  const addressOptions = useMemo<WizardReviewComboboxOption<WizardDeliveryRecipientAddress>[]>(() => recipientAddresses.map(
    (item, index) => ({
      entity: item,
      key: item.Id != null ? String(item.Id) : `address-${index}`,
      label: item.Value ?? '',
    }),
  ), [recipientAddresses])
  const addressKey = value.address?.Id != null ? String(value.address.Id) : null

  function selectTransporter(transporter: SalesUkraineTransporter) {
    onChange({ transporter })
  }

  function selectRecipient(recipient: WizardDeliveryRecipient) {
    if (draftRecipient && recipient === draftRecipient) {
      return
    }

    const patch: Partial<NewSaleReviewValue> = {}
    applyRecipientSelection(patch, recipient, undefined)

    // Re-picking the same person (or the typed-in draft) must not drop the phone the user just typed;
    // a different recipient still never inherits another person's phone.
    const samePerson = recipient === value.recipient ||
      (recipient.Id != null && recipient.Id === value.recipient?.Id) ||
      (value.isNewRecipient && Boolean(recipient.FullName) && recipient.FullName === value.recipient?.FullName)
    if (samePerson && !recipient.MobilePhone && value.mobilePhone) {
      patch.mobilePhone = value.mobilePhone
    }
    onChange(patch)
  }

  function selectAddress(address: WizardDeliveryRecipientAddress) {
    const patch: Partial<NewSaleReviewValue> = {}
    applyAddressSelection(patch, address)
    onChange(patch)
  }

  function clearAddress() {
    const empty = recipientAddresses.find((item) => item.Value === '')
    const patch: Partial<NewSaleReviewValue> = {}
    applyAddressSelection(patch, empty ?? null)
    onChange(patch)
  }

  /** Typing a new recipient only drafts it; nothing is written until the sale is saved. */
  function createRecipient(fullName: string) {
    const name = fullName.trim()

    if (!name) {
      return
    }

    const existing = recipients.find((item) => (item.FullName ?? '').trim().toLowerCase() === name.toLowerCase())

    if (existing) {
      selectRecipient(existing)

      return
    }

    onChange({
      address: null,
      isNewRecipient: true,
      recipient: { FullName: name, ...(syntheticClientId ? { ClientId: syntheticClientId } : {}) },
      recipientName: name,
    })
  }

  /**
   * Persists a drafted recipient (with the typed phone and address) right before the sale is saved.
   * Returns the recipient/address to send, or the current selection when there is no draft.
   */
  async function commitDraftRecipient(): Promise<{
    address: WizardDeliveryRecipientAddress | null
    recipient: WizardDeliveryRecipient | null
  }> {
    const current = latestRef.current.value

    if (!current.isNewRecipient || !current.recipient || (current.recipient.Id ?? 0) > 0) {
      return { address: current.address ?? null, recipient: current.recipient ?? null }
    }

    const clientId = syntheticClientId

    if (!clientId) {
      throw new Error(t('Не вдалося визначити клієнта для отримувача'))
    }

    if (recipientCreationRef.current) {
      throw new Error(t('Отримувач ще створюється'))
    }

    const request = Symbol()
    recipientCreationRef.current = request

    try {
      const created = await newDeliveryRecipient({
        ClientId: clientId,
        FullName: current.recipient.FullName,
        ...(current.mobilePhone.trim() ? { MobilePhone: current.mobilePhone.trim() } : {}),
      })

      if (!created || (created.Id ?? 0) <= 0) {
        throw new Error(t('Не вдалося створити отримувача'))
      }

      let address: WizardDeliveryRecipientAddress | null = null
      const addressValue = current.addressValue.trim()

      if (addressValue) {
        try {
          address = await newDeliveryRecipientAddress({
            DeliveryRecipient: created,
            DeliveryRecipientId: created.Id,
            Value: addressValue,
          })
        } catch {
          // The recipient exists now; keep it (a retry must not create a duplicate) and keep the typed address.
          address = null
          notifications.show({ color: 'orange', message: t('Отримувача створено, але адресу не збережено. Перевірте адресу.') })
        }
      }

      const recipient = address && (address.Id ?? 0) > 0
        ? { ...created, DeliveryRecipientAddresses: [...(created.DeliveryRecipientAddresses ?? []), address] }
        : created

      setRecipientData((data) => ({
        clientNetId,
        items: [...(data?.clientNetId === clientNetId ? data.items : []), recipient],
      }))
      latestRef.current.onChange({
        isNewRecipient: false,
        recipient,
        recipientName: recipient.FullName || '',
        ...(address && (address.Id ?? 0) > 0 ? { address, addressValue: '' } : {}),
      })

      return { address: address && (address.Id ?? 0) > 0 ? address : current.address ?? null, recipient }
    } finally {
      if (recipientCreationRef.current === request) recipientCreationRef.current = null
    }
  }

  async function createAddress(input: string) {
    const recipient = value.recipient
    const recipientId = recipient?.Id
    const normalizedInput = input.trim()

    if (!recipient || !recipientId || recipientId <= 0 || !normalizedInput) {
      return
    }

    const addresses = recipient.DeliveryRecipientAddresses ?? []
    const duplicate = addresses.find(
      (item) => (item.Value ?? '').trim().toLowerCase() === normalizedInput.toLowerCase(),
    )

    if (duplicate) {
      selectAddress(duplicate)

      return
    }

    if (addressCreationRef.current) return
    const request = Symbol()
    const generation = generationRef.current
    addressCreationRef.current = request

    try {
      const created = await newDeliveryRecipientAddress({
        DeliveryRecipient: recipient,
        DeliveryRecipientId: recipientId,
        Value: normalizedInput,
      })

      if (generationRef.current !== generation) return
      if (created && (created.Id ?? 0) > 0) {
        const currentRecipient = latestRef.current.value.recipient ?? recipient
        const updated = { ...currentRecipient, DeliveryRecipientAddresses: [...(currentRecipient.DeliveryRecipientAddresses ?? []), created] }

        setRecipientData((current) => current?.clientNetId === clientNetId
          ? { ...current, items: current.items.map((item) => item.Id === recipientId ? updated : item) }
          : current)
        latestRef.current.onChange({ address: created, addressValue: '', recipient: updated })
      } else {
        notifications.show({ color: 'red', message: t('Не вдалося створити адресу доставки') })
      }
    } catch {
      if (generationRef.current === generation) {
        notifications.show({ color: 'red', message: t('Не вдалося створити адресу доставки') })
      }
    } finally {
      if (addressCreationRef.current === request) addressCreationRef.current = null
    }
  }

  return {
    selfCheckout,
    transporterOptions, transporterKey, selectTransporter,
    recipientOptions, recipientKey, selectRecipient, createRecipient, commitDraftRecipient,
    addressOptions, addressKey, selectAddress, clearAddress, createAddress,
  }
}

const DRAFT_RECIPIENT_KEY = 'recipient-draft'

function applyRecipientSelection(
  patch: Partial<NewSaleReviewValue>,
  recipient: WizardDeliveryRecipient,
  preferredAddressNetUid: string | undefined,
) {
  patch.recipient = recipient
  patch.recipientName = recipient.FullName || ''
  patch.isNewRecipient = false
  patch.mobilePhone = recipient.MobilePhone || ''

  const addresses = recipient.DeliveryRecipientAddresses ?? []
  const preferred = preferredAddressNetUid ? addresses.find((item) => item.NetUid === preferredAddressNetUid) : undefined
  const address = preferred ?? addresses[0] ?? null

  applyAddressSelection(patch, address)
}

function applyAddressSelection(
  patch: Partial<NewSaleReviewValue>,
  address: WizardDeliveryRecipientAddress | null,
) {
  patch.address = address
  patch.addressValue = ''
  patch.city = address?.City || ''
  patch.department = address?.Department || ''
}
