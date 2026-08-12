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
  ClientSourceCardSnapshot,
} from '../../types'
import '../../pages/clients-structure-tree-page.css'

type ClientCommercialStructureViewProps = {
  structure: ClientCommercialStructure
  t: (value: string) => string
  onChanged?: () => void
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

export function ClientCommercialStructureView({ structure, t, onChanged }: ClientCommercialStructureViewProps) {
  const [pendingDecision, setPendingDecision] = useState<PendingIdentityDecision | null>(null)
  const [comment, setComment] = useState('')
  const [isSaving, setSaving] = useState(false)
  const groupTitle = structure.GroupName?.trim()
    || (structure.GroupKey ? `${t('Комерційна група')} · ${structure.GroupKey}` : t('Комерційна структура'))
  const { activeParties, rejectedCards } = partitionStructureCards(structure)
  const canManageIdentity = Boolean(onChanged && structure.IdentityMutationsEnabled)

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
          {activeParties.map((party) => (
            <LegalPartyNode
              key={party.Key}
              party={party}
              structure={structure}
              t={t}
              onDecision={canManageIdentity ? (decision) => {
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
                onDecision={canManageIdentity ? (decision) => {
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
                  await mutateClientIdentity(pendingDecision.kind, {
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
  party,
  structure,
  t,
  onDecision,
}: {
  party: ClientCommercialLegalParty
  structure: ClientCommercialStructure
  t: (value: string) => string
  onDecision?: (decision: PendingIdentityDecision) => void
}) {
  const relationshipClass = party.State === 'confirmed' || party.State === 'self'
    ? 'client-legal-party--confirmed'
    : party.State === 'probable'
      ? 'client-legal-party--probable'
      : 'client-legal-party--review'

  return (
    <details
      className={`client-legal-party ${relationshipClass}${party.IsTarget ? ' client-legal-party--target' : ''}`}
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
        {party.Cards.map((card) => (
          <ClientCard
            key={card.ClientId}
            card={card}
            structure={structure}
            t={t}
            onDecision={onDecision}
          />
        ))}
      </Stack>
    </details>
  )
}

function ClientCard({
  card,
  structure,
  t,
  onDecision,
}: {
  card: ClientCommercialCard
  structure: ClientCommercialStructure
  t: (value: string) => string
  onDecision?: (decision: PendingIdentityDecision) => void
}) {
  const fallbackAnchor = findConfirmedAnchor(structure, card.ClientNetUid)
  const anchorClientNetUid = structure.ClientNetUid === card.ClientNetUid
    ? fallbackAnchor?.ClientNetUid
    : structure.ClientNetUid

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
              <Text className="client-source-card__name">{card.DisplayName || t('Картка без назви')}</Text>
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
            <Text className="client-source-card__meta">
              {[
                card.RoleName,
                card.CurrentRegionCode || card.OriginalRegionCode,
                card.Usreou ? `${t('код')} ${card.Usreou}` : null,
              ].filter(Boolean).join(' · ') || t('Реквізити не заповнені')}
            </Text>
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
    </div>
  )
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
  const sourceLabel = snapshot.SourceSystem.toLowerCase() === 'amg' ? 'AMG' : 'Fenix'
  const groupName = snapshot.DirectClientGroupName || snapshot.MainClientName || snapshot.ClientGroupName

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
