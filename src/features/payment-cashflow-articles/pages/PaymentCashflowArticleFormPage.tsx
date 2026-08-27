import {
  Alert,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CircleAlert, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useReducer } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { usePermissions } from '../../auth/usePermissions'
import { PermissionKeys } from '../../../shared/auth/permissionKeys'
import {
  createPaymentCashflowArticle,
  deletePaymentCashflowArticle,
  getPaymentCashflowArticle,
  updatePaymentCashflowArticle,
} from '../api/paymentCashflowArticlesApi'
import type { PaymentCashflowArticle, PaymentCashflowArticlePayload } from '../types'

type LocationState = {
  returnPath?: string
}

const ARTICLES_PATH = '/accounting/payment-cashflow-articles'
const ARTICLE_NAME_MAX_LENGTH = 150
const PERMISSION_DELETE_CASHFLOW_ARTICLE =
  PermissionKeys.FinancialAdministration.CashflowArticles.Article.Delete
const PERMISSION_SAVE_CASHFLOW_ARTICLE =
  PermissionKeys.FinancialAdministration.CashflowArticles.Article.Save
const PERMISSION_CREATE_CASHFLOW_ARTICLE =
  PermissionKeys.FinancialAdministration.CashflowArticles.Article.Create
const PERMISSION_VIEW_CASHFLOW_ARTICLES =
  PermissionKeys.FinancialAdministration.CashflowArticles.Page.View

type ArticleFormState = {
  article: PaymentCashflowArticle
  operationName: string
  error: string | null
  isLoading: boolean
}

function articleFormStateReducer(
  state: ArticleFormState,
  patch: Partial<ArticleFormState>,
): ArticleFormState {
  return {
    ...state,
    ...patch,
  }
}

function createInitialArticleFormState(isEditMode: boolean): ArticleFormState {
  return {
    article: createEmptyArticle(),
    operationName: '',
    error: null,
    isLoading: isEditMode,
  }
}

export function PaymentCashflowArticleFormPage() {
  const { t } = useI18n()
  const { can, isLoading: permissionsLoading } = usePermissions()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || ARTICLES_PATH
  const isEditMode = Boolean(id)
  const [formState, setFormState] = useReducer(
    articleFormStateReducer,
    isEditMode,
    createInitialArticleFormState,
  )
  const { article, operationName, error, isLoading } = formState
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const canView = can(PERMISSION_VIEW_CASHFLOW_ARTICLES)
  const canCreate = can(PERMISSION_CREATE_CASHFLOW_ARTICLE)
  const canDelete = can(PERMISSION_DELETE_CASHFLOW_ARTICLE)
  const canSave = can(
    isEditMode
      ? PERMISSION_SAVE_CASHFLOW_ARTICLE
      : PERMISSION_CREATE_CASHFLOW_ARTICLE,
  )
  const canOpenRoute = canView && (isEditMode || canCreate)

  useEffect(() => {
    if (permissionsLoading || !canOpenRoute) {
      return
    }

    if (!id) {
      setFormState({
        article: createEmptyArticle(),
        operationName: '',
        isLoading: false,
      })
      return
    }

    const controller = new AbortController()

    async function loadArticle() {
      setFormState({
        error: null,
        isLoading: true,
      })

      try {
        const nextArticle = await getPaymentCashflowArticle(id as string)

        if (!controller.signal.aborted) {
          const loadedArticle = nextArticle || createEmptyArticle()

          setFormState({
            article: loadedArticle,
            operationName: loadedArticle.OperationName || '',
            isLoading: false,
          })
        }
      } catch (loadError) {
        if (!isAbortError(loadError) && !controller.signal.aborted) {
          setFormState({
            error: loadError instanceof Error ? loadError.message : t('Не вдалося завантажити статтю руху коштів'),
            isLoading: false,
          })
        }
      }
    }

    void loadArticle()

    return () => controller.abort()
  }, [canOpenRoute, id, permissionsLoading, t])

  if (permissionsLoading) {
    return <Text c="dimmed">{t('Завантаження')}</Text>
  }

  if (!canOpenRoute) {
    return (
      <Alert
        color="red"
        icon={<CircleAlert size={18} />}
        title={t('Доступ заборонено')}
        variant="light"
      >
        {t('Недостатньо прав для відкриття статті руху коштів')}
      </Alert>
    )
  }

  if (isEditMode && !id) {
    return <Navigate replace to={ARTICLES_PATH} />
  }

  function handleCancel() {
    if (isSaving || isDeleting) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) {
      setFormState({ error: t('Недостатньо прав для збереження') })
      return
    }

    const trimmedOperationName = operationName.trim()

    if (!trimmedOperationName) {
      setFormState({ error: t('Вкажіть назву статті руху коштів') })
      return
    }

    const netUid = article.NetUid || id

    if (isEditMode && !netUid) {
      setFormState({ error: t('Не вдалося визначити статтю руху коштів') })
      return
    }

    const payload: PaymentCashflowArticlePayload = {
      ...(netUid ? { NetUid: netUid } : {}),
      OperationName: trimmedOperationName,
    }

    setSaving(true)
    setFormState({ error: null })

    try {
      const savedArticle = isEditMode
        ? await updatePaymentCashflowArticle(payload)
        : await createPaymentCashflowArticle(payload)

      setFormState({ article: savedArticle || payload })
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Статтю руху коштів оновлено') : t('Статтю руху коштів створено'),
      })
      navigate(returnPath, { replace: true, state: { mutated: true } })
    } catch (saveError) {
      setFormState({
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти статтю руху коштів'),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!canDelete) {
      setFormState({ error: t('Недостатньо прав для видалення') })
      return
    }

    const netId = article.NetUid || id

    if (!netId) {
      return
    }

    setDeleting(true)
    setFormState({ error: null })

    try {
      await deletePaymentCashflowArticle(netId)
      notifications.show({
        color: 'green',
        message: t('Статтю руху коштів видалено'),
      })
      navigate(returnPath, { replace: true, state: { mutated: true } })
    } catch (deleteError) {
      setFormState({
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити статтю руху коштів'),
      })
    } finally {
      setDeleting(false)
      setDeleteModalOpened(false)
    }
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="compact"
      title={
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {isEditMode ? t('Редагування статті руху коштів') : t('Нова стаття руху коштів')}
        </span>
      }
      onClose={handleCancel}
      footer={
        <Group gap="xs">
          {isEditMode && canDelete && (
            <Button
              color="red"
              disabled={isLoading}
              leftSection={<Trash2 size={16} />}
              loading={isDeleting}
              type="button"
              variant="light"
              onClick={() => setDeleteModalOpened(true)}
            >
              {t('Видалити')}
            </Button>
          )}
          {canSave && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={isLoading}
              form="payment-cashflow-article-form"
              leftSection={<Save size={16} />}
              loading={isSaving}
              type="submit"
            >
              {t('Зберегти')}
            </Button>
          )}
        </Group>
      }
    >
      <form id="payment-cashflow-article-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <TextInput
            disabled={isLoading || isSaving || isDeleting || !canSave}
            label={t('Назва')}
            maxLength={ARTICLE_NAME_MAX_LENGTH}
            placeholder={t('Вкажіть назву')}
            required
            value={operationName}
            onChange={(event) => setFormState({ operationName: event.currentTarget.value })}
          />
        </Stack>
      </form>

      <AppModal
        centered
        opened={deleteModalOpened}
        title={t('Видалити статтю руху коштів')}
        onClose={() => setDeleteModalOpened(false)}
      >
        <Stack gap="md">
          <Text>
            {t('Видалити статтю')} <Text span fw={600}>{operationName || t('Без назви')}</Text>?
          </Text>
          <Group justify="flex-end">
            <Button color="gray" disabled={isDeleting} variant="light" onClick={() => setDeleteModalOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<Trash2 size={16} />} loading={isDeleting} onClick={handleDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </AppDrawer>
  )
}

function createEmptyArticle(): PaymentCashflowArticle {
  return {
    OperationName: '',
    PaymentMovementOperations: [],
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
