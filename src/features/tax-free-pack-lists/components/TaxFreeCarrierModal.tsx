import { Alert, Button, Group, Select, Stack, TextInput } from '@mantine/core'
import { AppModal } from "../../../shared/ui/AppModal"
import { IconAlertCircle, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { getCarrierById, searchCarriers, updateTaxFree } from '../api/taxFreePackListsApi'
import type { Statham, TaxFree } from '../types'
import { getPassportLabel, getStathamLabel } from '../utils'

type TaxFreeCarrierModalProps = {
  opened: boolean
  taxFree: TaxFree | null
  onClose: () => void
  onUpdated: (taxFree: TaxFree) => void
}

export function TaxFreeCarrierModal({ opened, taxFree, onClose, onUpdated }: TaxFreeCarrierModalProps) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [carriers, setCarriers] = useState<Statham[]>([])
  const [selectedCarrierNetId, setSelectedCarrierNetId] = useState<string | null>(null)
  const [selectedPassportNetId, setSelectedPassportNetId] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCarrier = useMemo(
    () => carriers.find((carrier) => carrier.NetUid === selectedCarrierNetId) || null,
    [carriers, selectedCarrierNetId],
  )

  function resetModalState(nextTaxFree: TaxFree) {
    setSearch(getStathamLabel(nextTaxFree.Statham || {}))
    setSelectedCarrierNetId(nextTaxFree.Statham?.NetUid || null)
    setSelectedPassportNetId(nextTaxFree.StathamPassport?.NetUid || null)
    setCarriers(nextTaxFree.Statham ? [nextTaxFree.Statham] : [])
    setError(null)
  }

  useEffect(() => {
    if (!opened || !taxFree) {
      return
    }

    queueMicrotask(() => resetModalState(taxFree))

    if (taxFree.Statham?.NetUid) {
      getCarrierById(taxFree.Statham.NetUid)
        .then((carrier) => {
          if (carrier) {
            setCarriers([carrier])
            setSelectedCarrierNetId(carrier.NetUid || null)
            setSelectedPassportNetId(taxFree.StathamPassport?.NetUid || carrier.StathamPassports?.[0]?.NetUid || null)
          }
        })
        .catch(() => undefined)
    }
  }, [opened, taxFree])

  useEffect(() => {
    if (!opened || search.trim().length < 2) {
      return
    }

    const controller = new AbortController()

    async function loadCarriers() {
      setLoading(true)

      try {
        const nextCarriers = await searchCarriers(search, controller.signal)
        setCarriers(nextCarriers)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося знайти перевізників'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadCarriers()

    return () => controller.abort()
  }, [opened, search, t])

  async function saveCarrier() {
    if (!taxFree || !selectedCarrier) {
      setError(t('Оберіть перевізника'))
      return
    }

    const passport = selectedCarrier.StathamPassports?.find((item) => item.NetUid === selectedPassportNetId)
      || selectedCarrier.StathamPassports?.[0]

    setSaving(true)
    setError(null)

    try {
      const updatedTaxFree = await updateTaxFree({
        ...taxFree,
        Statham: selectedCarrier,
        StathamPassport: passport,
      })

      if (updatedTaxFree) {
        onUpdated(updatedTaxFree)
      }
      notifications.show({ color: 'green', message: t('Перевізника збережено') })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти перевізника'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppModal centered opened={opened} size="lg" title={t('Перевізник')} onClose={onClose}>
      <Stack>
        {error && (
          <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
            {error}
          </Alert>
        )}

        <TextInput
          leftSection={<IconSearch size={16} />}
          label={t('Пошук перевізника')}
          placeholder={t('Мінімум 2 символи')}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Select
          clearable
          data={carriers.reduce<{ label: string; value: string }[]>((acc, carrier) => {
            const item = {
              label: getStathamLabel(carrier),
              value: carrier.NetUid || String(carrier.Id || ''),
            }
            if (item.value) acc.push(item)
            return acc
          }, [])}
          label={t('Перевізник')}
          nothingFoundMessage={isLoading ? t('Завантаження') : t('Нічого не знайдено')}
          value={selectedCarrierNetId}
          onChange={(value) => {
            const carrier = carriers.find((item) => item.NetUid === value)
            setSelectedCarrierNetId(value)
            setSelectedPassportNetId(carrier?.StathamPassports?.[0]?.NetUid || null)
          }}
        />
        {selectedCarrier && (
          <Select
            clearable
            data={(selectedCarrier.StathamPassports || []).reduce<{ label: string; value: string }[]>((acc, passport) => {
              const item = {
                label: getPassportLabel(passport) || t('Паспорт'),
                value: passport.NetUid || String(passport.Id || ''),
              }
              if (item.value) acc.push(item)
              return acc
            }, [])}
            label={t('Паспорт перевізника')}
            value={selectedPassportNetId}
            onChange={setSelectedPassportNetId}
          />
        )}

        <Group justify="flex-end">
          <Button disabled={isSaving} variant="subtle" onClick={onClose}>{t('Скасувати')}</Button>
          <Button loading={isSaving} onClick={saveCarrier}>{t('Зберегти')}</Button>
        </Group>
      </Stack>
    </AppModal>
  )
}
