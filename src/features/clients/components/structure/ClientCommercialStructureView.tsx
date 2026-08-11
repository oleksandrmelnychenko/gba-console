import { Alert, Badge, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'
import { Building2, CircleAlert, FileText, GitBranch, Landmark, Store, UserRoundCheck } from 'lucide-react'
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
      <Group align="flex-start" justify="space-between" gap="sm" wrap="wrap">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <ThemeIcon color="indigo" radius="md" size={38} variant="light">
            <GitBranch size={19} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="lg">{groupTitle}</Text>
            <Text c="dimmed" size="xs">
              {t('Зріз даних')}: {formatDateTime(structure.AsOfUtc)}
            </Text>
          </div>
        </Group>
        <StateBadge state={structure.State} t={t} />
      </Group>

      {structure.RequiresReview ? (
        <Alert color={structure.IsPartial ? 'red' : 'yellow'} icon={<CircleAlert size={18} />} variant="light">
          <Text fw={650} size="sm">
            {structure.IsPartial
              ? t('Показано не всю групу')
              : t('Є дані, які треба перевірити')}
          </Text>
          <Text c="dimmed" mt={3} size="xs">
            {t('Система нічого не об’єднує автоматично. Робочі картки, договори, продажі й баланси залишаються без змін.')}
          </Text>
        </Alert>
      ) : null}

      <SimpleGrid className="client-commercial-summary" cols={{ base: 2, md: 4 }} spacing="xs">
        <SummaryMetric label={t('Юросіб')} value={structure.LegalParties.length} />
        <SummaryMetric label={t('Карток клієнта')} value={structure.CardCount} />
        <SummaryMetric
          label={t('Договорів')}
          value={`${structure.ActiveAgreementCount}/${structure.AgreementCount}`}
        />
        <SummaryMetric label={t('Продажів')} value={structure.SaleCount} />
      </SimpleGrid>

      <Stack gap="xs">
        <Text fw={650} size="sm">{t('Структура клієнта')}</Text>
        {structure.LegalParties.map((party) => (
          <LegalPartyNode key={party.Key} party={party} t={t} />
        ))}
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
        <Group align="center" justify="space-between" gap="sm" wrap="nowrap">
          <Group align="center" gap="sm" wrap="nowrap">
            <ThemeIcon color={party.RequiresReview ? 'yellow' : 'teal'} radius="xl" size={32} variant="light">
              <Landmark size={16} />
            </ThemeIcon>
            <div className="client-legal-party__identity">
              <Text fw={650} size="sm">{party.DisplayName || t('Юрособа без назви')}</Text>
              <Text c="dimmed" size="xs">
                {party.NormalizedLegalCode
                  ? `${t('ЄДРПОУ / ІПН')}: ${party.NormalizedLegalCode}`
                  : t('Юридичний код не вказано')}
              </Text>
            </div>
          </Group>
          <Group gap={6} wrap="nowrap">
            {party.IsTarget ? <Badge color="indigo" size="xs" variant="light">{t('Обрана')}</Badge> : null}
            {party.RequiresReview ? <Badge color="yellow" size="xs" variant="light">{t('Перевірити')}</Badge> : null}
            <Badge color="gray" size="xs" variant="light">
              {party.Cards.length} {t('карт.')}
            </Badge>
          </Group>
        </Group>
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
      <Group align="flex-start" justify="space-between" gap="sm" wrap="wrap">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <ThemeIcon color={card.IsTarget ? 'indigo' : 'gray'} radius="md" size={30} variant="light">
            {card.IsTradePoint ? <Store size={15} /> : <Building2 size={15} />}
          </ThemeIcon>
          <div>
            <Group gap={6} wrap="wrap">
              <Text fw={600} size="sm">{card.DisplayName || t('Картка без назви')}</Text>
              {card.IsTarget ? <Badge color="indigo" size="xs" variant="light">{t('Обрана')}</Badge> : null}
              {card.IsTradePoint ? <Badge color="blue" size="xs" variant="light">{t('Торгова точка')}</Badge> : null}
              {card.IsSubClient && !card.IsTradePoint ? <Badge color="blue" size="xs" variant="light">{t('Підклієнт')}</Badge> : null}
              {card.HasExplicitRelationship && !card.IsSubClient && !card.IsTradePoint ? (
                <Badge color="teal" size="xs" variant="light">{t('Явний зв’язок')}</Badge>
              ) : null}
              {card.IsBlocked ? <Badge color="red" size="xs" variant="light">{t('Заблокована')}</Badge> : null}
              {!card.IsActive ? <Badge color="gray" size="xs" variant="light">{t('Неактивна')}</Badge> : null}
            </Group>
            <Text c="dimmed" size="xs">
              {[
                card.RoleName,
                card.CurrentRegionCode || card.OriginalRegionCode,
                card.Usreou ? `${t('код')} ${card.Usreou}` : null,
              ].filter(Boolean).join(' · ') || t('Реквізити не заповнені')}
            </Text>
          </div>
        </Group>
        <Group gap={6} wrap="wrap">
          <Badge color="gray" size="sm" variant="light">
            <FileText size={12} /> {card.ActiveAgreementCount}/{card.AgreementCount}
          </Badge>
          <Badge color="gray" size="sm" variant="light">
            <UserRoundCheck size={12} /> {card.SaleCount}
          </Badge>
        </Group>
      </Group>

    </div>
  )
}

function TechnicalAudit({ structure, t }: ClientCommercialStructureViewProps) {
  const cards = structure.LegalParties.flatMap((party) => party.Cards)

  return (
    <details className="client-structure-audit">
      <summary>{t('Деталі перевірки 1С')}</summary>
      <Stack gap="sm" mt="sm">
        <Text c="dimmed" size="xs">
          {t('Тут зібрані службові ознаки та сирі значення Fenix/AMG. Вони потрібні лише для розбору розбіжностей.')}
        </Text>
        <ReasonList reasons={structure.Reasons} t={t} />
        {cards.map((card) => (
          <details className="client-source-evidence" key={card.ClientId}>
            <summary>
              {card.DisplayName || t('Картка без назви')} · {card.SourceSnapshots.length} {t('джерел')}
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
        <Badge color={sourceLabel === 'AMG' ? 'orange' : 'blue'} size="sm" variant="light">{sourceLabel}</Badge>
        <Text c="dimmed" size="xs">{formatDateTime(snapshot.LastSeenAtUtc)}</Text>
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
      <Text fw={700} size="lg">{value}</Text>
      <Text c="dimmed" size="xs">{label}</Text>
    </div>
  )
}

function StateBadge({ state, t }: { state: ClientCommercialStructureState; t: (value: string) => string }) {
  const config: Record<ClientCommercialStructureState, { color: string; label: string }> = {
    self: { color: 'gray', label: t('Окрема картка') },
    confirmed: { color: 'teal', label: t('Підтверджено') },
    probable: { color: 'blue', label: t('Ймовірний зв’язок') },
    review_required: { color: 'yellow', label: t('Потрібна перевірка') },
  }

  return <Badge color={config[state].color} variant="light">{config[state].label}</Badge>
}

function ReasonList({ reasons, t }: { reasons: string[]; t: (value: string) => string }) {
  if (reasons.length === 0) {
    return null
  }

  return (
    <Group className="client-structure-reasons" gap={5} mt="xs" wrap="wrap">
      {reasons.map((reason) => (
        <Badge color={reason.includes('conflicting') || reason.includes('invalid') ? 'red' : 'gray'} key={reason} size="xs" variant="outline">
          {reasonLabel(reason, t)}
        </Badge>
      ))}
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
