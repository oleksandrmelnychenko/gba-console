import { Alert, Loader, Select, Stack, Text } from '@mantine/core'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import { getWizardClientAgreements } from '../../../sales-ukraine/components/new-sale-wizard/wizardClientStepApi'
import type { ClientAgreement } from '../../types'

type Props = {
  clientNetId: string
  children: (agreement: ClientAgreement) => ReactNode
}

export function RecommendationAgreementScope(props: Props) {
  return <AgreementScope key={props.clientNetId} {...props} />
}

function AgreementScope({ clientNetId, children }: Props) {
  const { t } = useI18n()
  const [state, setState] = useState<{
    agreements: ClientAgreement[]
    error: string | null
    loading: boolean
  }>({ agreements: [], error: null, loading: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const rows = clientNetId ? await getWizardClientAgreements(clientNetId) : []
        const agreements = rows.filter((row) => row.NetUid && !row.Deleted && !row.Agreement?.Deleted && row.Agreement?.IsActive)
        if (!cancelled) {
          setState({ agreements, error: null, loading: false })
          setSelectedId(agreements[0]?.NetUid ?? null)
        }
      } catch (error) {
        if (!cancelled) {
          setState({ agreements: [], error: error instanceof Error ? error.message : t('Не вдалося завантажити договори'), loading: false })
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [clientNetId, t])

  if (state.loading) return <Loader aria-label={t('Завантаження договору')} size="sm" />
  if (state.error) return <Alert color="red">{state.error}</Alert>
  if (state.agreements.length === 0) {
    return <Text c="dimmed">{t('Для рекомендацій потрібен активний договір клієнта')}</Text>
  }

  const agreement = state.agreements.find((row) => row.NetUid === selectedId)
  return (
    <Stack gap="sm">
      <Select
        allowDeselect={false}
        label={t('Договір')}
        description={t('Історія покупок, наявність і ціни за вибраним договором')}
        data={state.agreements.map((row) => ({
          value: row.NetUid!,
          label: [row.Agreement?.Name || row.AgreementName || row.NetUid,
            row.Agreement?.Organization?.Name,
            t(row.Agreement?.WithVATAccounting ? 'З ПДВ' : 'Без ПДВ')].filter(Boolean).join(' · '),
        }))}
        value={selectedId}
        onChange={setSelectedId}
      />
      {agreement && <Fragment key={agreement.NetUid}>{children(agreement)}</Fragment>}
    </Stack>
  )
}
