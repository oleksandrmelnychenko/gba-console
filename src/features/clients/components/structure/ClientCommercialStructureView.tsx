import { Alert, Badge, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'
import { Building2, ChevronRight, CircleAlert, Landmark, Store } from 'lucide-react'
import type {
  ClientCommercialCard,
  ClientCommercialLegalParty,
  ClientCommercialStructure,
  ClientCommercialStructureState,
  ClientSourceCardSnapshot,
} from '../../types'
import '../../pages/clients-structure-tree-page.css'

type ClientCommercialStructureViewProps = {
  structure: ClientCommercialStructure
  t: (value: string) => string
}

const dateTimeFormatter = new Intl.DateTimeFormat('uk-UA', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function ClientCommercialStructureView({ structure, t }: ClientCommercialStructureViewProps) {
  const groupTitle = structure.GroupName?.trim()
    || (structure.GroupKey ? `${t('Комерційна група')} · ${structure.GroupKey}` : t('Комерційна структура'))

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
          {structure.LegalParties.map((party) => (
            <LegalPartyNode key={party.Key} party={party} t={t} />
          ))}
        </div>
      </Stack>

      <TechnicalAudit structure={structure} t={t} />
    </Stack>
  )
}

function LegalPartyNode({ party, t }: { party: ClientCommercialLegalParty; t: (value: string) => string }) {
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
          <ClientCard key={card.ClientId} card={card} t={t} />
        ))}
      </Stack>
    </details>
  )
}

function ClientCard({ card, t }: { card: ClientCommercialCard; t: (value: string) => string }) {
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
        </Group>
      </Group>
    </div>
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
