type PaymentPurposeSuggestionScopeParams = {
  clientAgreementNetId?: string
  clientNetId?: string
  counterpartySearch: string
  selectedClientName: string
}

export function getPaymentPurposeSuggestionScope({
  clientAgreementNetId,
  clientNetId,
  counterpartySearch,
  selectedClientName,
}: PaymentPurposeSuggestionScopeParams) {
  if (
    !clientAgreementNetId ||
    !clientNetId ||
    selectedClientName.trim() !== counterpartySearch.trim()
  ) {
    return {}
  }

  return { clientAgreementNetId, clientNetId }
}
