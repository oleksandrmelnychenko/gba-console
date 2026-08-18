import { Alert, Badge, Button, Group, Menu, SimpleGrid, Stack, Text, Textarea, ThemeIcon } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Ban, Building2, ChevronRight, CircleAlert, Copy, Landmark, Link2, MoreHorizontal, Star, Store, Unlink } from 'lucide-react'
import { useState } from 'react'
import { AppModal, AppModalFooter } from '../../../../shared/ui/AppModal'
import { mutateClientIdentity } from '../../api/clientsApi'
import type {
  ClientCommercialCard,
  ClientCommercialLegalParty,
  ClientCommercialStructure,
  ClientCommercialStructureState,
  ClientIdentityMutationKind,
  ClientSourceAgreementSnapshot,
  ClientSourceCardSnapshot,
  ClientSourceContactSnapshot,
} from '../../types'
import '../../pages/clients-structure-tree-page.css'

type ClientCommercialStructureViewProps = {
  structure: ClientCommercialStructure
  t: (value: string) => string
  onChanged?: () => void
  canManageIdentity?: boolean
  mutateIdentity?: typeof mutateClientIdentity
}

type PendingIdentityDecision = {
  kind: ClientIdentityMutationKind
  relationshipKind?: 'related' | 'duplicate'
  card: ClientCommercialCard
  anchorClientNetUid: string
  title: string
  description: string
}

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})
const sourceAmountFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 2,
})
const dateOnlyFormatter = new Intl.DateTimeFormat('uk-UA')

export function ClientCommercialStructureView({
  structure,
  t,
  onChanged,
  canManageIdentity = false,
  mutateIdentity = mutateClientIdentity,
}: ClientCommercialStructureViewProps) {
  const [pendingDecision, setPendingDecision] = useState<PendingIdentityDecision | null>(null)
  const [comment, setComment] = useState('')
  const [isSaving, setSaving] = useState(false)
  const groupTitle = getCommercialGroupTitle(structure, t)
  const { activeParties, rejectedCards } = partitionStructureCards(structure)
  const partyHierarchy = buildLegalPartyHierarchy(activeParties)
  const activeCardsById = indexActiveCards(activeParties)
  const canManageIdentityActions = Boolean(
    canManageIdentity && onChanged && structure.IdentityMutationsEnabled,
  )

  return (
    <Stack className="client-commercial-structure" gap="md">
      <Group className="client-commercial-hero" align="flex-start" justify="space-between" gap="sm" wrap="wrap">
        <div className="client-commercial-hero__identity">
          <Text className="app-section-title client-commercial-title">{groupTitle}</Text>
          <Text className="client-commercial-as-of">
            {t('Зріз даних')}: <span>{formatDateTime(structure.AsOfUtc)}</span>
          </Text>
        </div>
        <StateBadge state={structure.State} t={t} />
      </Group>

      {structure.RequiresReview ? (
        <Alert
          className={`client-commercial-alert${structure.IsPartial ? ' is-critical' : ''}`}
          color={structure.IsPartial ? 'red' : 'orange'}
          icon={<CircleAlert size={17} />}
          variant="light"
        >
          <Text className="client-commercial-alert__title">
            {structure.IsPartial
              ? t('Показано не всю групу')
              : t('Є дані, які треба перевірити')}
          </Text>
          <Text className="client-commercial-alert__description">
            {t('Система нічого не об’єднує автоматично. Робочі картки, договори, продажі й баланси залишаються без змін.')}
          </Text>
        </Alert>
      ) : null}

      {structure.IdentityMutationsEnabled !== true ? (
        <Alert color="blue" icon={<CircleAlert size={17} />} variant="light">
          <Text className="client-commercial-alert__title">
            {t('Рішення щодо зв’язків тимчасово недоступні')}
          </Text>
          <Text className="client-commercial-alert__description">
            {t('Структуру побудовано з наявних даних 1С. Підтвердження, відхилення та зміна головної картки стануть доступні після оновлення бази даних.')}
          </Text>
        </Alert>
      ) : null}

      <SimpleGrid className="client-commercial-summary" cols={{ base: 2, md: 4 }} spacing={0}>
        <SummaryMetric label={t('Юросіб')} value={structure.LegalParties.length} />
        <SummaryMetric label={t('Карток клієнта')} value={structure.CardCount} />
        <SummaryMetric
          label={t('Договорів')}
          value={`${structure.ActiveAgreementCount}/${structure.AgreementCount}`}
        />
        <SummaryMetric label={t('Продажів')} value={structure.SaleCount} />
      </SimpleGrid>

      <Stack className="client-commercial-parties" gap={7}>
        <Text className="app-section-title">{t('Структура клієнта')}</Text>
        <div className="client-commercial-parties__list">
          {partyHierarchy.map((node) => (
            <LegalPartyNode
              key={node.party.Key}
              activeCardsById={activeCardsById}
              node={node}
              structure={structure}
              t={t}
              onDecision={canManageIdentityActions ? (decision) => {
                setComment('')
                setPendingDecision(decision)
              } : undefined}
            />
          ))}
        </div>
      </Stack>

      {rejectedCards.length > 0 ? (
        <details className="client-structure-audit client-rejected-candidates">
          <summary>
            <span className="client-structure-audit__summary">
              <ChevronRight className="client-structure-audit__chevron" size={15} />
              <span>{t('Відхилені кандидати')}</span>
              <Badge className="app-role-pill is-gray" size="xs" variant="light">{rejectedCards.length}</Badge>
            </span>
          </summary>
          <Stack gap="xs" mt="sm">
            <Text c="dimmed" size="xs">
              {t('Ці картки не враховуються як підтверджений зв’язок. Рішення можна змінити через меню дій.')}
            </Text>
            {rejectedCards.map((card) => (
              <ClientCard
                key={card.ClientId}
                card={card}
                structure={structure}
                t={t}
                onDecision={canManageIdentityActions ? (decision) => {
                  setComment('')
                  setPendingDecision(decision)
                } : undefined}
              />
            ))}
          </Stack>
        </details>
      ) : null}

      <TechnicalAudit structure={structure} t={t} />

      <AppModal
        centered
        opened={Boolean(pendingDecision)}
        title={pendingDecision?.title || t('Зв’язок клієнтів')}
        onClose={() => {
          if (!isSaving) {
            setPendingDecision(null)
            setComment('')
          }
        }}
      >
        <Stack gap="md">
          <Text size="sm">{pendingDecision?.description}</Text>
          <Alert color="blue" icon={<CircleAlert size={17} />} variant="light">
            {t('Договори, продажі, платежі та баланси залишаться на своїх картках. Зміниться лише підтверджена структура й спільний кредитний контроль.')}
          </Alert>
          <Textarea
            autosize
            label={t('Коментар до рішення')}
            maxLength={500}
            minRows={3}
            placeholder={t('Чому картки треба зв’язати або розділити')}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
          />
          <AppModalFooter>
            <Button color="gray" disabled={isSaving} variant="default" onClick={() => setPendingDecision(null)}>
              {t('Скасувати')}
            </Button>
            <Button
              color={pendingDecision?.kind === 'reject' || pendingDecision?.kind === 'unlink' ? 'red' : 'orange'}
              loading={isSaving}
              onClick={async () => {
                if (!pendingDecision) return
                setSaving(true)
                try {
                  await mutateIdentity(pendingDecision.kind, {
                    ClientNetUid: pendingDecision.anchorClientNetUid,
                    RelatedClientNetUid: pendingDecision.card.ClientNetUid,
                    RelationshipKind: pendingDecision.relationshipKind,
                    ExpectedRevision: structure.ConfirmedGroupRevision,
                    Comment: comment.trim() || null,
                  })
                  notifications.show({ color: 'green', message: t('Рішення збережено') })
                  setPendingDecision(null)
                  setComment('')
                  onChanged?.()
                } catch (error: unknown) {
                  notifications.show({
                    color: 'red',
                    message: error instanceof Error ? error.message : t('Не вдалося зберегти рішення'),
                  })
                } finally {
                  setSaving(false)
                }
              }}
            >
              {t('Підтвердити')}
            </Button>
          </AppModalFooter>
        </Stack>
      </AppModal>
    </Stack>
  )
}

function LegalPartyNode({
  node,
  activeCardsById,
  structure,
  t,
  onDecision,
  depth = 0,
}: {
  node: ClientLegalPartyHierarchyNodeModel
  activeCardsById: ReadonlyMap<number, ClientCommercialCard>
  structure: ClientCommercialStructure
  t: (value: string) => string
  onDecision?: (decision: PendingIdentityDecision) => void
  depth?: number
}) {
  const { party } = node
  const cardHierarchy = buildClientCardHierarchy(party.Cards, activeCardsById)
  const relationshipClass = party.State === 'confirmed' || party.State === 'self'
    ? 'client-legal-party--confirmed'
    : party.State === 'probable'
      ? 'client-legal-party--probable'
      : 'client-legal-party--review'

  return (
    <details
      className={`client-legal-party ${relationshipClass}${party.IsTarget ? ' client-legal-party--target' : ''}`}
      data-legal-party-depth={depth}
      data-legal-party-key={party.Key}
      open={party.IsTarget}
    >
      <summary className="client-legal-party__summary">
        <div className="client-legal-party__summary-layout">
          <ChevronRight className="client-legal-party__chevron" size={16} />
          <Group className="client-legal-party__main" align="center" gap="sm" wrap="nowrap">
            <ThemeIcon
              className="client-legal-party__icon"
              color={party.IsTarget ? 'orange' : 'gray'}
              radius="xl"
              size={30}
              variant="outline"
            >
              <Landmark size={16} />
            </ThemeIcon>
            <div className="client-legal-party__identity">
              <Text className="client-legal-party__name">{party.DisplayName || t('Юрособа без назви')}</Text>
              <Text className="client-legal-party__code">
                {party.NormalizedLegalCode
                  ? `${t('ЄДРПОУ / ІПН')}: ${party.NormalizedLegalCode}`
                  : t('Юридичний код не вказано')}
              </Text>
            </div>
          </Group>
          <Group className="client-legal-party__badges" gap={6} wrap="nowrap">
            {party.IsTarget ? <Badge className="app-role-pill is-orange" size="xs" variant="light">{t('Обрана')}</Badge> : null}
            {party.RequiresReview ? <Badge className="app-role-pill is-orange" size="xs" variant="light">{t('Перевірити')}</Badge> : null}
            <Badge className="app-role-pill is-gray" size="xs" variant="light">
              {party.Cards.length} {t('карт.')}
            </Badge>
          </Group>
        </div>
      </summary>

      <Stack className="client-legal-party__cards" gap="xs">
        {cardHierarchy.map((node) => (
          <ClientCardHierarchyNode
            key={node.card.ClientId}
            node={node}
            structure={structure}
            t={t}
            onDecision={onDecision}
          />
        ))}
      </Stack>
      {node.children.length > 0 ? (
        <div className="client-legal-party-tree-children">
          {node.children.map((child) => (
            <LegalPartyNode
              key={child.party.Key}
              activeCardsById={activeCardsById}
              depth={depth + 1}
              node={child}
              structure={structure}
              t={t}
              onDecision={onDecision}
            />
          ))}
        </div>
      ) : null}
    </details>
  )
}

type ClientLegalPartyHierarchyNodeModel = {
  party: ClientCommercialLegalParty
  children: ClientLegalPartyHierarchyNodeModel[]
}

function indexActiveCards(
  parties: ClientCommercialLegalParty[],
): ReadonlyMap<number, ClientCommercialCard> {
  const cardsById = new Map<number, ClientCommercialCard>()
  for (const party of parties) {
    for (const card of party.Cards) {
      if (!card.IsRejectedCandidate) cardsById.set(card.ClientId, card)
    }
  }
  return cardsById
}

function buildLegalPartyHierarchy(
  parties: ClientCommercialLegalParty[],
): ClientLegalPartyHierarchyNodeModel[] {
  const partiesByKey = new Map(parties.map((party) => [party.Key, party]))
  const partyKeyByClientId = new Map<number, string>()
  for (const party of parties) {
    for (const card of party.Cards) {
      if (!card.IsRejectedCandidate) partyKeyByClientId.set(card.ClientId, party.Key)
    }
  }

  const parentByPartyKey = new Map<string, string>()
  for (const party of parties) {
    const parentKeys = new Set<string>()
    for (const card of party.Cards) {
      if (card.IsRejectedCandidate || !card.MainClientId) continue
      const parentKey = partyKeyByClientId.get(card.MainClientId)
      if (parentKey && parentKey !== party.Key) parentKeys.add(parentKey)
    }
    if (parentKeys.size === 1) {
      parentByPartyKey.set(party.Key, [...parentKeys][0])
    }
  }

  const cyclePartyKeys = new Set<string>()
  for (const party of parties) {
    const path = new Set<string>()
    let currentKey: string | undefined = party.Key
    while (currentKey !== undefined && parentByPartyKey.has(currentKey)) {
      if (path.has(currentKey)) {
        path.forEach((key) => cyclePartyKeys.add(key))
        break
      }
      path.add(currentKey)
      currentKey = parentByPartyKey.get(currentKey)
    }
  }
  cyclePartyKeys.forEach((key) => parentByPartyKey.delete(key))

  const childrenByPartyKey = new Map<string, ClientCommercialLegalParty[]>()
  for (const party of parties) {
    const parentKey = parentByPartyKey.get(party.Key)
    if (!parentKey || !partiesByKey.has(parentKey)) continue
    const children = childrenByPartyKey.get(parentKey) || []
    children.push(party)
    childrenByPartyKey.set(parentKey, children)
  }

  const sortParties = (left: ClientCommercialLegalParty, right: ClientCommercialLegalParty) => {
    if (left.IsTarget !== right.IsTarget) return left.IsTarget ? -1 : 1
    return (left.DisplayName || '').localeCompare(right.DisplayName || '', 'uk') || left.Key.localeCompare(right.Key)
  }
  const buildNode = (party: ClientCommercialLegalParty): ClientLegalPartyHierarchyNodeModel => ({
    party,
    children: (childrenByPartyKey.get(party.Key) || []).sort(sortParties).map(buildNode),
  })

  return parties
    .filter((party) => !parentByPartyKey.has(party.Key))
    .sort(sortParties)
    .map(buildNode)
}

type ClientCardHierarchyNodeModel = {
  card: ClientCommercialCard
  parentCard?: ClientCommercialCard
  children: ClientCardHierarchyNodeModel[]
}

function ClientCardHierarchyNode({
  node,
  structure,
  t,
  onDecision,
  depth = 0,
}: {
  node: ClientCardHierarchyNodeModel
  structure: ClientCommercialStructure
  t: (value: string) => string
  onDecision?: (decision: PendingIdentityDecision) => void
  depth?: number
}) {
  return (
    <div
      className="client-source-card-tree-node"
      data-client-depth={depth}
      data-client-id={node.card.ClientId}
    >
      <ClientCard
        card={node.card}
        parentCard={node.parentCard}
        structure={structure}
        t={t}
        onDecision={onDecision}
      />
      {node.children.length > 0 ? (
        <div className="client-source-card-tree-children">
          {node.children.map((child) => (
            <ClientCardHierarchyNode
              key={child.card.ClientId}
              depth={depth + 1}
              node={child}
              structure={structure}
              t={t}
              onDecision={onDecision}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function buildClientCardHierarchy(
  cards: ClientCommercialCard[],
  allCardsById: ReadonlyMap<number, ClientCommercialCard>,
): ClientCardHierarchyNodeModel[] {
  const visibleCards = cards.filter((card) => !card.IsRejectedCandidate)
  const cardsById = new Map(visibleCards.map((card) => [card.ClientId, card]))
  const parentByClientId = new Map<number, number>()

  for (const card of visibleCards) {
    if (card.MainClientId && card.MainClientId !== card.ClientId && cardsById.has(card.MainClientId)) {
      parentByClientId.set(card.ClientId, card.MainClientId)
    }
  }

  // Malformed legacy data must not make the UI recurse forever. Every card
  // participating in a cycle becomes a root and remains visible for review.
  const cycleClientIds = new Set<number>()
  for (const card of visibleCards) {
    const path = new Set<number>()
    let currentClientId: number | undefined = card.ClientId
    while (currentClientId !== undefined && parentByClientId.has(currentClientId)) {
      if (path.has(currentClientId)) {
        path.forEach((clientId) => cycleClientIds.add(clientId))
        break
      }
      path.add(currentClientId)
      currentClientId = parentByClientId.get(currentClientId)
    }
  }
  cycleClientIds.forEach((clientId) => parentByClientId.delete(clientId))

  const childrenByParentId = new Map<number, ClientCommercialCard[]>()
  for (const card of visibleCards) {
    const parentId = parentByClientId.get(card.ClientId)
    if (parentId === undefined) continue
    const children = childrenByParentId.get(parentId) || []
    children.push(card)
    childrenByParentId.set(parentId, children)
  }

  const sortCards = (left: ClientCommercialCard, right: ClientCommercialCard) => {
    if (left.IsTarget !== right.IsTarget) return left.IsTarget ? -1 : 1
    return (left.DisplayName || '').localeCompare(right.DisplayName || '', 'uk') || left.ClientId - right.ClientId
  }
  const buildNode = (card: ClientCommercialCard): ClientCardHierarchyNodeModel => ({
    card,
    parentCard: card.MainClientId ? allCardsById.get(card.MainClientId) : undefined,
    children: (childrenByParentId.get(card.ClientId) || []).sort(sortCards).map(buildNode),
  })

  return visibleCards
    .filter((card) => !parentByClientId.has(card.ClientId))
    .sort(sortCards)
    .map(buildNode)
}

function ClientCard({
  card,
  parentCard,
  structure,
  t,
  onDecision,
}: {
  card: ClientCommercialCard
  parentCard?: ClientCommercialCard
  structure: ClientCommercialStructure
  t: (value: string) => string
  onDecision?: (decision: PendingIdentityDecision) => void
}) {
  const fallbackAnchor = findConfirmedAnchor(structure, card.ClientNetUid)
  const anchorClientNetUid = structure.ClientNetUid === card.ClientNetUid
    ? fallbackAnchor?.ClientNetUid
    : structure.ClientNetUid
  const roleLabel = getClientRoleLabel(card.RoleType, card.RoleName, t)
  const regionCode = card.CurrentRegionCode || card.OriginalRegionCode
  const legalCode = card.Usreou || card.Tin
  const sourceSnapshots = getCardSourceSnapshots(card)
  const displayName = getPreferredCardDisplayName(card, t)

  return (
    <div className={`client-source-card${card.IsTarget ? ' client-source-card--target' : ''}`}>
      <Group align="center" justify="space-between" gap="sm" wrap="nowrap">
        <Group className="client-source-card__main" align="center" gap="sm" wrap="nowrap">
          <ThemeIcon
            className="client-source-card__icon"
            color={card.IsTarget ? 'orange' : 'gray'}
            radius="xl"
            size={28}
            variant="outline"
          >
            {card.IsTradePoint ? <Store size={15} /> : <Building2 size={15} />}
          </ThemeIcon>
          <div className="client-source-card__identity">
            <Group gap={5} wrap="wrap">
              <Text className="client-source-card__name">{displayName}</Text>
              {card.IsTarget ? <Badge className="app-role-pill is-orange" size="xs" variant="light">{t('Обрана')}</Badge> : null}
              {card.IsTradePoint ? <Badge className="app-role-pill is-gray" size="xs" variant="light">{t('Торгова точка')}</Badge> : null}
              {card.IsSubClient && !card.IsTradePoint ? <Badge className="app-role-pill is-gray" size="xs" variant="light">{t('Підклієнт')}</Badge> : null}
              {card.HasExplicitRelationship && !card.IsSubClient && !card.IsTradePoint ? (
                <Badge className="app-role-pill is-green" size="xs" variant="light">{t('Явний зв’язок')}</Badge>
              ) : null}
              {card.IsPrimaryClient ? <Badge className="app-role-pill is-green" size="xs" variant="light">{t('Головна картка')}</Badge> : null}
              {card.IsConfirmedMember && !card.IsPrimaryClient ? (
                <Badge className="app-role-pill is-green" size="xs" variant="light">
                  {card.ConfirmedRelationshipKind === 'duplicate' ? t('Підтверджений дубль') : t('Підтверджений зв’язок')}
                </Badge>
              ) : null}
              {card.IsRejectedCandidate ? <Badge className="app-role-pill is-gray" size="xs" variant="light">{t('Зв’язок відхилено')}</Badge> : null}
              {card.IsBlocked ? <Badge className="app-role-pill is-red" size="xs" variant="light">{t('Заблокована')}</Badge> : null}
              {!card.IsActive ? <Badge className="app-role-pill is-gray" size="xs" variant="light">{t('Неактивна')}</Badge> : null}
            </Group>
            <Group className="client-source-card__meta" gap={5} wrap="wrap">
              {roleLabel ? (
                <Badge className="client-card-role-chip" color="teal" size="xs" variant="light">
                  {roleLabel}
                </Badge>
              ) : null}
              {regionCode ? (
                <Badge className="client-card-code-chip" color="blue" size="xs" variant="light">
                  {regionCode}
                </Badge>
              ) : null}
              {legalCode ? (
                <Badge className="client-card-code-chip" color="gray" size="xs" variant="outline">
                  {t('код')} {legalCode}
                </Badge>
              ) : null}
              {card.MainClientId ? (
                <Text className="client-source-card__parent" component="span">
                  {t('Головний клієнт')}: {parentCard ? getPreferredCardDisplayName(parentCard, t) : `#${card.MainClientId}`}
                </Text>
              ) : null}
              {card.DisplayName?.trim() && card.DisplayName.trim() !== displayName ? (
                <Text className="client-source-card__parent" component="span">
                  {t('Картка GBA')}: {card.DisplayName.trim()}
                </Text>
              ) : null}
              {!roleLabel && !regionCode && !legalCode && !card.MainClientId ? (
                <Text className="client-source-card__parent" component="span">
                  {t('Реквізити не заповнені')}
                </Text>
              ) : null}
            </Group>
          </div>
        </Group>
        <Group className="client-source-card__stats" gap={14} wrap="nowrap">
          <ClientCardMetric label={t('Договори')} value={`${card.ActiveAgreementCount}/${card.AgreementCount}`} />
          <ClientCardMetric label={t('Продажі')} value={card.SaleCount} />
          {onDecision && anchorClientNetUid ? (
            <ClientIdentityActions
              anchorClientNetUid={anchorClientNetUid}
              card={card}
              t={t}
              onDecision={onDecision}
            />
          ) : null}
        </Group>
      </Group>
      {sourceSnapshots.length > 0 ? (
        <div className="client-source-card__source-tree">
          <Text className="client-source-card__agreements-title">
            {t('Дані 1С')} · {sourceSnapshots.length}
          </Text>
          <div className="client-source-card__source-list">
            {sourceSnapshots.map((snapshot) => (
              <ClientSourceTreeNode
                key={`${snapshot.SourceSystem}-${snapshot.SourceCode}`}
                asOfUtc={structure.AsOfUtc}
                snapshot={snapshot}
                t={t}
              />
            ))}
          </div>
        </div>
      ) : (
        <Text className="client-source-card__source-empty">{t('Очікує синку')}</Text>
      )}
    </div>
  )
}

function ClientSourceTreeNode({
  asOfUtc,
  snapshot,
  t,
}: {
  asOfUtc: string
  snapshot: ClientSourceCardSnapshot
  t: (value: string) => string
}) {
  const sourceName = snapshot.FullName?.trim()
    || snapshot.ClientName?.trim()
    || `#${snapshot.SourceCode}`
  const shortName = snapshot.ClientName?.trim()
  const agreements = snapshot.Agreements || []

  return (
    <div
      className={`client-source-card__source-node${snapshot.SourceMarkedDeleted ? ' is-deleted' : ''}`}
      data-source-code={snapshot.SourceCode}
      data-source-system={snapshot.SourceSystem.toLowerCase()}
    >
      <div className="client-source-card__source-header">
        <Badge className="app-role-pill is-gray" size="xs" variant="light">
          {getSourceLabel(snapshot.SourceSystem)}
        </Badge>
        {snapshot.SourceMarkedDeleted ? (
          <Badge className="app-role-pill is-red" size="xs" variant="light">
            {t('видалений у 1С')}
          </Badge>
        ) : null}
        <div className="client-source-card__source-identity">
          <Text className="client-source-card__source-name">{sourceName}</Text>
          {shortName && shortName !== sourceName ? (
            <Text className="client-source-card__source-short-name">{shortName}</Text>
          ) : null}
          <Text className="client-source-card__source-code">
            #{snapshot.SourceCode}
            {snapshot.RegionCode?.trim() ? ` · ${snapshot.RegionCode.trim()}` : ''}
          </Text>
        </div>
      </div>
      <div className="client-source-card__agreements">
        <Text className="client-source-card__agreements-title">
          {t('Договори 1С')} · {agreements.length}
        </Text>
        {agreements.length > 0 ? (
          <div className="client-source-card__agreement-list">
            {agreements.map((agreement) => {
              const activity = getSourceAgreementActivity(
                agreement,
                asOfUtc,
                snapshot.SourceMarkedDeleted,
              )
              return (
                <span
                  className={`client-source-card__agreement is-${activity.kind}`}
                  key={`${snapshot.SourceSystem}-${snapshot.SourceCode}-${agreement.SourceCode}-${agreement.AgreementType || ''}-${agreement.Number || ''}-${agreement.FromDate || ''}-${agreement.ToDate || ''}`}
                >
                  <span>{getSourceAgreementTitle(agreement)}</span>
                  {getSourceAgreementDetails(agreement) ? (
                    <span className="client-source-card__agreement-details">
                      {getSourceAgreementDetails(agreement)}
                    </span>
                  ) : null}
                  <span className={`client-source-card__agreement-state is-${activity.kind}`}>
                    {t(activity.label)}
                  </span>
                </span>
              )
            })}
          </div>
        ) : (
          <Text className="client-source-card__source-empty">{t('Немає договорів у 1С')}</Text>
        )}
      </div>
    </div>
  )
}

function getCommercialGroupTitle(
  structure: ClientCommercialStructure,
  t: (value: string) => string,
): string {
  const groupKey = structure.GroupKey?.trim()
  const groupName = structure.GroupName?.trim()
  const displayGroupKey = groupKey ? getCommercialGroupDisplayKey(groupKey) : ''

  if (displayGroupKey && groupName && !groupKey?.includes(':')) return `${displayGroupKey} · ${groupName}`
  if (groupName) return groupName
  if (displayGroupKey) return `${t('Комерційна група')} · ${displayGroupKey}`
  return t('Комерційна структура')
}

function getCommercialGroupDisplayKey(groupKey: string): string {
  const match = /^XM(\d+)$/i.exec(groupKey.trim())
  return match ? `ХМ${match[1]}` : groupKey.trim()
}

function getCardSourceSnapshots(card: ClientCommercialCard): ClientSourceCardSnapshot[] {
  return card.SourceSnapshots
    .toSorted((left, right) => Number(left.SourceMarkedDeleted) - Number(right.SourceMarkedDeleted)
      || getSourcePriority(left.SourceSystem) - getSourcePriority(right.SourceSystem)
      || left.SourceCode - right.SourceCode)
}

function getActiveCardSourceSnapshots(card: ClientCommercialCard): ClientSourceCardSnapshot[] {
  return getCardSourceSnapshots(card)
    .filter((snapshot) => !snapshot.SourceMarkedDeleted)
}

function getPreferredCardDisplayName(
  card: ClientCommercialCard,
  t: (value: string) => string,
): string {
  const preferredSource = getActiveCardSourceSnapshots(card)[0]
  return preferredSource?.FullName?.trim()
    || preferredSource?.ClientName?.trim()
    || card.DisplayName?.trim()
    || t('Картка без назви')
}

function getSourcePriority(sourceSystem: string): number {
  if (sourceSystem.toLowerCase() === 'fenix') return 0
  if (sourceSystem.toLowerCase() === 'amg') return 1
  return 2
}

type SourceAgreementActivity = {
  kind: 'current' | 'deleted' | 'expired' | 'future' | 'retained'
  label: string
}

function getSourceAgreementActivity(
  agreement: ClientSourceAgreementSnapshot,
  asOfUtc: string,
  sourceMarkedDeleted: boolean,
): SourceAgreementActivity {
  if (sourceMarkedDeleted || agreement.SourceMarkedDeleted) {
    return { kind: 'deleted', label: 'видалений у 1С' }
  }

  const asOfDay = getUtcDay(asOfUtc)
  const fromDay = getUtcDay(agreement.FromDate)
  const toDay = getUtcDay(agreement.ToDate)
  if (asOfDay !== null && fromDay !== null && fromDay > asOfDay) {
    return { kind: 'future', label: 'ще не діє на дату зрізу' }
  }
  if (asOfDay !== null && toDay !== null && toDay < asOfDay) {
    return { kind: 'expired', label: 'строк дії минув' }
  }
  if (asOfDay !== null && (fromDay !== null || toDay !== null)) {
    return { kind: 'current', label: 'чинний на дату зрізу' }
  }

  return { kind: 'retained', label: 'не видалений у 1С' }
}

function getUtcDay(value: string | null | undefined): number | null {
  if (!value) return null

  // GBA serializes UTC DateTime values without a trailing offset. Agreement
  // bounds are business dates, so preserve their ISO calendar prefix instead
  // of letting the browser reinterpret midnight in its local timezone.
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (isoDate) {
    const year = Number(isoDate[1])
    const month = Number(isoDate[2])
    const day = Number(isoDate[3])
    const utcDay = Date.UTC(year, month - 1, day)
    const validated = new Date(utcDay)
    return validated.getUTCFullYear() === year
      && validated.getUTCMonth() === month - 1
      && validated.getUTCDate() === day
      ? utcDay
      : null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function getClientRoleLabel(
  roleType: number | null | undefined,
  roleName: string | null | undefined,
  t: (value: string) => string,
): string | null {
  if (roleType === 0 || roleName?.trim().toLowerCase() === 'buyer') {
    return t('Покупець')
  }
  if (roleType === 1 || ['provider', 'supplier'].includes(roleName?.trim().toLowerCase() || '')) {
    return t('Постачальник')
  }

  const normalizedName = roleName?.trim()
  return normalizedName ? t(normalizedName) : null
}

function partitionStructureCards(structure: ClientCommercialStructure): {
  activeParties: ClientCommercialLegalParty[]
  rejectedCards: ClientCommercialCard[]
} {
  const activeParties: ClientCommercialLegalParty[] = []
  const rejectedCards: ClientCommercialCard[] = []

  for (const party of structure.LegalParties) {
    let hasActiveCard = false
    for (const card of party.Cards) {
      if (card.IsRejectedCandidate) {
        rejectedCards.push(card)
      } else {
        hasActiveCard = true
      }
    }
    if (hasActiveCard) {
      activeParties.push(party)
    }
  }

  return { activeParties, rejectedCards }
}

function findConfirmedAnchor(
  structure: ClientCommercialStructure,
  excludedClientNetUid: string,
): ClientCommercialCard | undefined {
  for (const party of structure.LegalParties) {
    for (const card of party.Cards) {
      if (card.IsConfirmedMember && card.ClientNetUid !== excludedClientNetUid) {
        return card
      }
    }
  }
  return undefined
}

function ClientIdentityActions({
  anchorClientNetUid,
  card,
  t,
  onDecision,
}: {
  anchorClientNetUid: string
  card: ClientCommercialCard
  t: (value: string) => string
  onDecision: (decision: PendingIdentityDecision) => void
}) {
  const decide = (
    kind: ClientIdentityMutationKind,
    title: string,
    description: string,
    relationshipKind?: 'related' | 'duplicate',
  ) => onDecision({ kind, relationshipKind, card, anchorClientNetUid, title, description })

  return (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>
        <Button
          aria-label={t('Дії зі зв’язком')}
          leftSection={<MoreHorizontal size={15} />}
          size="compact-xs"
          variant="light"
        >
          {t('Дії')}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {!card.IsConfirmedMember ? (
          <>
            <Menu.Item leftSection={<Link2 size={15} />} onClick={() => decide(
              'confirm',
              t('Підтвердити зв’язок'),
              `${t('Додати до однієї підтвердженої структури')}: ${card.DisplayName || t('Картка без назви')}`,
              'related',
            )}>{t('Підтвердити зв’язок')}</Menu.Item>
            <Menu.Item leftSection={<Copy size={15} />} onClick={() => decide(
              'confirm',
              t('Позначити дубль'),
              `${t('Позначити як іншу картку того самого клієнта')}: ${card.DisplayName || t('Картка без назви')}`,
              'duplicate',
            )}>{t('Позначити дубль')}</Menu.Item>
            {!card.IsRejectedCandidate ? (
              <>
                <Menu.Divider />
                <Menu.Item color="red" leftSection={<Ban size={15} />} onClick={() => decide(
                  'reject',
                  t('Відхилити зв’язок'),
                  `${t('Більше не пропонувати цю картку як пов’язану')}: ${card.DisplayName || t('Картка без назви')}`,
                )}>{t('Це інший клієнт')}</Menu.Item>
              </>
            ) : null}
          </>
        ) : (
          <>
            {!card.IsPrimaryClient ? (
              <Menu.Item leftSection={<Star size={15} />} onClick={() => decide(
                'primary',
                t('Змінити головну картку'),
                `${t('Зробити головною карткою структури')}: ${card.DisplayName || t('Картка без назви')}`,
              )}>{t('Зробити головною')}</Menu.Item>
            ) : null}
            {!card.IsPrimaryClient && card.ConfirmedRelationshipKind !== 'duplicate' ? (
              <Menu.Item leftSection={<Copy size={15} />} onClick={() => decide(
                'confirm',
                t('Позначити дубль'),
                `${t('Позначити як іншу картку того самого клієнта')}: ${card.DisplayName || t('Картка без назви')}`,
                'duplicate',
              )}>{t('Позначити дубль')}</Menu.Item>
            ) : null}
            {!card.IsPrimaryClient && card.ConfirmedRelationshipKind === 'duplicate' ? (
              <Menu.Item leftSection={<Link2 size={15} />} onClick={() => decide(
                'confirm',
                t('Позначити пов’язаною карткою'),
                `${t('Залишити у структурі як окрему пов’язану картку')}: ${card.DisplayName || t('Картка без назви')}`,
                'related',
              )}>{t('Це не дубль')}</Menu.Item>
            ) : null}
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<Unlink size={15} />} onClick={() => decide(
              'unlink',
              t('Від’єднати картку'),
              `${t('Прибрати картку з підтвердженої структури')}: ${card.DisplayName || t('Картка без назви')}`,
            )}>{t('Від’єднати')}</Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

function ClientCardMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="client-source-card__stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

function TechnicalAudit({ structure, t }: ClientCommercialStructureViewProps) {
  const cards = structure.LegalParties.flatMap((party) => party.Cards)

  return (
    <details className="client-structure-audit">
      <summary>
        <span className="client-structure-audit__summary">
          <ChevronRight className="client-structure-audit__chevron" size={15} />
          <span>{t('Деталі перевірки 1С')}</span>
          <Badge className="app-role-pill is-gray" size="xs" variant="light">{cards.length}</Badge>
        </span>
      </summary>
      <Stack gap="sm" mt="sm">
        <Text className="client-structure-audit__description">
          {t('Тут зібрані службові ознаки та сирі значення Fenix/AMG. Вони потрібні лише для розбору розбіжностей.')}
        </Text>
        <ReasonList reasons={structure.Reasons} t={t} />
        {cards.map((card) => (
          <details className="client-source-evidence" key={card.ClientId}>
            <summary>
              <span className="client-source-evidence__summary">
                <ChevronRight className="client-source-evidence__chevron" size={14} />
                <span>{card.DisplayName || t('Картка без назви')}</span>
                <Badge className="app-role-pill is-gray" size="xs" variant="light">
                  {card.SourceSnapshots.length} {t('джерел')}
                </Badge>
              </span>
            </summary>
            <ReasonList reasons={card.Reasons} t={t} />
            {card.SourceSnapshots.length > 0 ? (
              <SimpleGrid cols={{ base: 1, xl: 2 }} mt="xs" spacing="xs">
                {card.SourceSnapshots.map((snapshot) => (
                  <SourceSnapshot
                    key={`${snapshot.SourceSystem}-${snapshot.SourceCode}`}
                    snapshot={snapshot}
                    t={t}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <Text c="dimmed" mt="xs" size="xs">
                {t('Дані джерела з’являться після синку клієнтів')}
              </Text>
            )}
          </details>
        ))}
      </Stack>
    </details>
  )
}

function SourceSnapshot({ snapshot, t }: { snapshot: ClientSourceCardSnapshot; t: (value: string) => string }) {
  const sourceLabel = getSourceLabel(snapshot.SourceSystem)
  const groupName = snapshot.DirectClientGroupName || snapshot.MainClientName || snapshot.ClientGroupName
  const contacts = snapshot.Contacts || []
  const agreements = snapshot.Agreements || []
  const bankAccount = [snapshot.BankAccountNumber, snapshot.BankCurrencyCode].filter(Boolean).join(' · ')
  const mainContact = [snapshot.MainContactPersonName, snapshot.MainContactPersonPosition].filter(Boolean).join(' · ')

  return (
    <div className="client-source-snapshot">
      <Group justify="space-between" gap="xs" wrap="wrap">
        <Badge className={`app-role-pill ${sourceLabel === 'AMG' ? 'is-orange' : 'is-gray'}`} size="sm" variant="light">{sourceLabel}</Badge>
        <Text className="client-source-snapshot__date">{formatDateTime(snapshot.LastSeenAtUtc)}</Text>
      </Group>
      <EvidenceRow label={t('Код у 1С')} value={snapshot.SourceCode > 0 ? snapshot.SourceCode : t('пошкоджений')} />
      <EvidenceRow label={t('Назва у 1С')} value={snapshot.FullName || snapshot.ClientName} />
      <EvidenceRow label={t('Код регіону')} value={snapshot.RegionCode} />
      <EvidenceRow label={t('Головний клієнт')} value={snapshot.MainClientCode ? `${snapshot.MainClientCode}${snapshot.MainClientName ? ` · ${snapshot.MainClientName}` : ''}` : null} />
      <EvidenceRow label={t('Група у 1С')} value={groupName} />
      <EvidenceRow label={t('ЄДРПОУ / ІПН')} value={snapshot.Usreou || snapshot.Tin} />
      <EvidenceRow label={t('Менеджер у 1С')} value={snapshot.ManagerName} />
      <EvidenceRow label={t('Головна контактна особа')} value={mainContact} />
      <EvidenceRow label={t('Банк')} value={snapshot.BankName} />
      <EvidenceRow label={t('Рахунок / валюта')} value={bankAccount} />
      <EvidenceRow
        label={t('Контроль строку боргу')}
        value={snapshot.IsControlDayDebt == null
          ? null
          : snapshot.IsControlDayDebt
            ? `${t('увімкнено')} · ${snapshot.QuantityDayDebt ?? 0} ${t('дн.')}`
            : t('вимкнено')}
      />

      {contacts.length > 0 ? (
        <div className="client-source-evidence-group">
          <Text className="client-source-evidence-group__title">{t('Контакти та адреси 1С')}</Text>
          {contacts.map((contact) => (
            <EvidenceRow
              key={`${contact.AddressType}-${contact.InfoType}-${contact.SourceAddressKindCode}-${contact.Value}`}
              label={sourceContactLabel(contact, t)}
              value={contact.Value}
            />
          ))}
        </div>
      ) : null}

      {agreements.length > 0 ? (
        <div className="client-source-evidence-group">
          <Text className="client-source-evidence-group__title">
            {t('Договори та кредитні умови 1С')} · {agreements.length}
          </Text>
          <Stack gap={6}>
            {agreements.map((agreement) => (
              <SourceAgreement
                key={`${agreement.SourceCode}-${agreement.AgreementType || ''}`}
                agreement={agreement}
                t={t}
              />
            ))}
          </Stack>
        </div>
      ) : null}

      {!snapshot.SourceIdentityValid ? (
        <Text c="red" mt={5} size="xs">{t('Пошкоджений ідентифікатор джерела — потрібна перевірка')}</Text>
      ) : null}
      {snapshot.SourceMarkedDeleted ? (
        <Text c="red" mt={5} size="xs">{t('Картку позначено видаленою у 1С — не використовуйте без перевірки')}</Text>
      ) : null}
      {snapshot.EvidenceTruncated ? (
        <Text c="orange" mt={5} size="xs">{t('Пошкоджене або надмірно довге значення з 1С нормалізовано — перевірте оригінал')}</Text>
      ) : null}
    </div>
  )
}

function SourceAgreement({
  agreement,
  t,
}: {
  agreement: ClientSourceAgreementSnapshot
  t: (value: string) => string
}) {
  const title = getSourceAgreementTitle(agreement)
  const validity = [formatDateOnly(agreement.FromDate), formatDateOnly(agreement.ToDate)].filter(Boolean).join(' — ')
  const accountKinds = [
    agreement.IsManagementAccounting ? t('управлінський') : null,
    agreement.IsAccounting ? t('бухгалтерський') : null,
  ].filter(Boolean).join(', ')

  return (
    <div className="client-source-agreement">
      <Group gap="xs" justify="space-between" wrap="wrap">
        <Text className="client-source-agreement__title">{title}</Text>
        {agreement.SourceMarkedDeleted ? (
          <Badge className="app-role-pill is-red" size="xs" variant="light">{t('видалений у 1С')}</Badge>
        ) : null}
      </Group>
      <EvidenceRow label={t('Код договору')} value={agreement.SourceCode} />
      <EvidenceRow label={t('Організація')} value={agreement.OrganizationName} />
      <EvidenceRow label={t('Валюта')} value={agreement.CurrencyCode} />
      <EvidenceRow label={t('Тип ціни')} value={agreement.TypePriceName} />
      <EvidenceRow label={t('Ліміт боргу')} value={formatSourceAmount(agreement.PermissibleDebtAmount, agreement.CurrencyCode)} />
      <EvidenceRow label={t('Відстрочка платежу')} value={`${agreement.DebtDaysAllowedNumber || 0} ${t('дн.')}`} />
      <EvidenceRow label={t('Період дії')} value={validity} />
      <EvidenceRow label={t('Облік')} value={accountKinds} />
    </div>
  )
}

function getSourceLabel(sourceSystem: string): string {
  return sourceSystem.toLowerCase() === 'amg' ? 'AMG' : 'Fenix'
}

function getSourceAgreementTitle(agreement: ClientSourceAgreementSnapshot): string {
  const name = agreement.Name?.trim()
  const number = agreement.Number?.trim()

  if (name && number && name !== number) return `${name} · ${number}`
  return name || number || `#${agreement.SourceCode}`
}

function getSourceAgreementDetails(agreement: ClientSourceAgreementSnapshot): string {
  const validity = [formatDateOnly(agreement.FromDate), formatDateOnly(agreement.ToDate)]
    .filter(Boolean)
    .join(' — ')

  return [
    agreement.CurrencyCode?.trim(),
    agreement.OrganizationName?.trim(),
    agreement.TypePriceName?.trim(),
    validity,
  ].filter(Boolean).join(' · ')
}

function sourceContactLabel(
  contact: ClientSourceContactSnapshot,
  t: (value: string) => string,
): string {
  const labels: Record<string, string> = {
    AccountingNumber: t('Телефон бухгалтера'),
    ActualAddress: t('Фактична адреса'),
    DeliveryAddress: t('Адреса доставки'),
    DeliveryNumber: t('Телефон доставки'),
    DirectorName: t('Керівник'),
    Email: 'Email',
    FaxNumber: t('Факс'),
    Icq: 'ICQ',
    LegalAddress: t('Юридична адреса'),
    ManagerNumber: t('Телефон менеджера'),
    MobileNumber: t('Мобільний телефон'),
    PhoneNumber: t('Телефон'),
    Website: t('Сайт'),
  }
  const label = contact.InfoType ? labels[contact.InfoType] || contact.InfoType : contact.AddressType || t('Контакт')
  return contact.IsUnclassified ? `${label} · ${t('не класифіковано')}` : label
}

function formatSourceAmount(value: number, currencyCode?: string | null): string | null {
  if (!Number.isFinite(value)) return null
  return `${sourceAmountFormatter.format(value)}${currencyCode ? ` ${currencyCode}` : ''}`
}

function formatDateOnly(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateOnlyFormatter.format(date)
}

function EvidenceRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Group className="client-evidence-row" gap="xs" justify="space-between" wrap="nowrap">
      <Text c="dimmed" size="xs">{label}</Text>
      <Text className="client-evidence-value" size="xs">{value ?? '—'}</Text>
    </Group>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="client-commercial-metric">
      <Text className="client-commercial-metric__label">{label}</Text>
      <Text className="client-commercial-metric__value">{value}</Text>
    </div>
  )
}

function StateBadge({ state, t }: { state: ClientCommercialStructureState; t: (value: string) => string }) {
  const config: Record<ClientCommercialStructureState, { className: string; label: string }> = {
    self: { className: 'is-gray', label: t('Окрема картка') },
    confirmed: { className: 'is-green', label: t('Підтверджено') },
    probable: { className: '', label: t('Ймовірний зв’язок') },
    review_required: { className: 'is-orange', label: t('Потрібна перевірка') },
  }

  return (
    <Badge className={`app-role-pill client-commercial-state ${config[state].className}`} variant="light">
      {config[state].label}
    </Badge>
  )
}

function ReasonList({ reasons, t }: { reasons: string[]; t: (value: string) => string }) {
  if (reasons.length === 0) {
    return null
  }

  return (
    <Group className="client-structure-reasons" gap={5} mt="xs" wrap="wrap">
      {reasons.map((reason) => {
        const isCritical = reason.includes('conflicting') || reason.includes('invalid') || reason === 'source_marked_deleted'
        const needsAttention = reason.includes('missing') || reason.includes('truncated') || reason === 'candidate_limit_exceeded'

        return (
          <Badge
            className={`app-role-pill ${isCritical ? 'is-red' : needsAttention ? 'is-orange' : 'is-gray'}`}
            key={reason}
            size="xs"
            variant="light"
          >
            {reasonLabel(reason, t)}
          </Badge>
        )
      })}
    </Group>
  )
}

function reasonLabel(reason: string, t: (value: string) => string): string {
  const labels: Record<string, string> = {
    explicit_hierarchy: t('Явний зв’язок'),
    manual_confirmation: t('Підтверджено вручну'),
    manual_rejection: t('Зв’язок відхилено вручну'),
    identity_resolution_unavailable: t('Рішення щодо зв’язків недоступні'),
    source_hierarchy: t('Ієрархія 1С'),
    conflicting_source_hierarchy: t('Конфлікт ієрархій 1С'),
    region_code_family: t('Схожий код регіону'),
    conflicting_region_code_family: t('Конфлікт кодів регіону'),
    source_group_name: t('Назва групи з 1С'),
    conflicting_source_group_name: t('Конфлікт назв груп'),
    same_legal_code: t('Однаковий юркод'),
    conflicting_legal_code: t('Конфлікт юркодів'),
    missing_legal_code: t('Немає юркоду'),
    invalid_source_identity: t('Пошкоджений ID джерела'),
    source_marked_deleted: t('Позначено видаленим у 1С'),
    candidate_limit_exceeded: t('Забагато кандидатів'),
    truncated_source_evidence: t('Нормалізоване значення з 1С'),
  }
  return labels[reason] || reason
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date)
}
