import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { useI18n } from '../../../../shared/i18n/useI18n'
import {
  getWizardMergedSaleNetUid,
  getWizardSplitOrderItems,
  getWizardSplitRecovery,
  setWizardSplitOrderItems,
} from './newSaleWizardState'
import type { WizardCartEditorState } from './wizardCartEditor'
import type { WizardCartLocalCommit } from './wizardCartMutation'
import type { WizardSplitOrderItem, WizardSplitRecoverySource } from './wizardSplitSale'

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
export type WizardCartSplitCommit = Extract<WizardCartLocalCommit, { kind: 'replace-split-items' }>

export function useWizardCartSplitState({
  agreementNetId, saleNetUid, userKey, setEditCart,
}: {
  agreementNetId: string | null
  saleNetUid: string | undefined
  userKey: string | null
  setEditCart: Dispatch<SetStateAction<WizardCartEditorState | null>>
}) {
  const { t } = useI18n()
  const getSplitRecoverySource = useCallback((
    targetAgreementNetId: string | null = agreementNetId,
    targetSaleNetUid: string | null | undefined = saleNetUid,
  ): WizardSplitRecoverySource => {
    const agreement = normalize(targetAgreementNetId)
    const sale = normalize(targetSaleNetUid)
    const user = normalize(userKey)
    if (!agreement || agreement === EMPTY_GUID || !sale || sale === EMPTY_GUID || !user) {
      throw new Error(t('Неможливо безпечно зберегти розділення без поточного рахунку та користувача'))
    }

    const existing = getWizardSplitRecovery()
    if (existing) {
      if (existing.agreementNetId !== agreement || existing.saleNetUid !== sale || existing.userKey !== user) {
        throw new Error(t('Збережений розділений кошик належить іншому рахунку або користувачу'))
      }
      // Preserve the original source even if the merged-sale view has since closed.
      return { agreementNetId: existing.agreementNetId, saleNetUid: existing.saleNetUid, userKey: existing.userKey, origin: existing.origin }
    }
    return { agreementNetId: agreement, saleNetUid: sale, userKey: user,
      origin: normalize(getWizardMergedSaleNetUid()) === sale ? 'merged' : 'ordinary' }
  }, [agreementNetId, saleNetUid, userKey, t])

  const persistSplitItems = useCallback((items: WizardSplitOrderItem[], targetAgreementNetId: string | null = agreementNetId) => {
    if (items.length === 0) {
      // Empty writes resolve recovery too, so they need the same source check as non-empty writes.
      if (getWizardSplitRecovery()) getSplitRecoverySource(targetAgreementNetId)
      setWizardSplitOrderItems([], null)
      return
    }
    setWizardSplitOrderItems(items, targetAgreementNetId, getSplitRecoverySource(targetAgreementNetId))
  }, [agreementNetId, getSplitRecoverySource])

  const readSplitItems = useCallback(() => {
    if (getWizardSplitRecovery()) getSplitRecoverySource()
    return getWizardSplitOrderItems()
  }, [getSplitRecoverySource])

  const commitLocalChange = useCallback((commit: WizardCartSplitCommit) => {
    // Storage errors must leave the visible editor unchanged.
    persistSplitItems(commit.splitItems, commit.agreementNetId)
    setEditCart((previous) => previous ? {
      ...previous,
      ...(commit.isSplit === undefined ? {} : { isSplit: commit.isSplit }),
      ...(commit.selected === undefined ? {} : { selected: commit.selected }),
      splitItems: commit.splitItems,
    } : previous)
  }, [persistSplitItems, setEditCart])

  return { getSplitRecoverySource, persistSplitItems, readSplitItems, commitLocalChange }
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}
