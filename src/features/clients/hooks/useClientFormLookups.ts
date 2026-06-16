import { useEffect } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  getAllRegions,
  getClientResourceCurrencies,
  getIncoterms,
  getPackingMarkingPayments,
  getPackingMarkings,
  getSupplierCountries,
} from '../api/clientLookupsApi'
import type {
  Country,
  Currency,
  Incoterm,
  PackingMarking,
  PackingMarkingPayment,
  Region,
} from '../types'

export type ClientFormLookups = {
  countries: Country[]
  currencies: Currency[]
  incoterms: Incoterm[]
  packingMarkings: PackingMarking[]
  packingMarkingPayments: PackingMarkingPayment[]
  regions: Region[]
}

export type UseClientFormLookupsResult = {
  lookups: ClientFormLookups
  isLoading: boolean
  error: string | null
  reloadRegions: () => Promise<void>
  reloadIncoterms: () => Promise<void>
  reloadCountries: () => Promise<void>
}

const EMPTY_LOOKUPS: ClientFormLookups = {
  countries: [],
  currencies: [],
  incoterms: [],
  packingMarkings: [],
  packingMarkingPayments: [],
  regions: [],
}

type LookupOptions = {
  enabled?: boolean
  needsProviderLookups: boolean
  needsBuyerLookups: boolean
}

export function useClientFormLookups(options: LookupOptions): UseClientFormLookupsResult {
  const { t } = useI18n()
  const [lookups, setLookups] = useValueState<ClientFormLookups>(EMPTY_LOOKUPS)
  const [isLoading, setLoading] = useValueState(true)
  const [error, setError] = useValueState<string | null>(null)
  const { enabled = true, needsProviderLookups, needsBuyerLookups } = options

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setError(null)
      return undefined
    }

    let cancelled = false

    async function loadLookups() {
      setLoading(true)
      setError(null)

      try {
        const [countries, incoterms, packingMarkings, packingMarkingPayments, currencies, regions] = await Promise.all([
          needsProviderLookups ? getSupplierCountries() : Promise.resolve<Country[]>([]),
          needsProviderLookups ? getIncoterms() : Promise.resolve<Incoterm[]>([]),
          needsProviderLookups ? getPackingMarkings() : Promise.resolve<PackingMarking[]>([]),
          needsProviderLookups ? getPackingMarkingPayments() : Promise.resolve<PackingMarkingPayment[]>([]),
          getClientResourceCurrencies(),
          needsBuyerLookups ? getAllRegions() : Promise.resolve<Region[]>([]),
        ])

        if (!cancelled) {
          setLookups({
            countries,
            currencies,
            incoterms,
            packingMarkings,
            packingMarkingPayments,
            regions,
          })
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadLookups()

    return () => {
      cancelled = true
    }
  }, [enabled, needsProviderLookups, needsBuyerLookups, setLookups, setLoading, setError, t])

  async function reloadRegions() {
    try {
      const regions = await getAllRegions()
      setLookups((current) => ({ ...current, regions }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
    }
  }

  async function reloadIncoterms() {
    try {
      const incoterms = await getIncoterms()
      setLookups((current) => ({ ...current, incoterms }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
    }
  }

  async function reloadCountries() {
    try {
      const countries = await getSupplierCountries()
      setLookups((current) => ({ ...current, countries }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити довідники'))
    }
  }

  return {
    lookups,
    isLoading,
    error,
    reloadRegions,
    reloadIncoterms,
    reloadCountries,
  }
}
