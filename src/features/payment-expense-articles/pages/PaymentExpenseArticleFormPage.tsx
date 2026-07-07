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
import { type FormEvent, useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppDrawer } from '../../../shared/ui/AppDrawer'
import { AppModal } from '../../../shared/ui/AppModal'
import { CREATE_ACTION_COLOR } from '../../../shared/ui/page-header-actions/PageHeaderActions'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import {
  createPaymentExpenseArticle,
  deletePaymentExpenseArticle,
  getPaymentExpenseArticle,
  updatePaymentExpenseArticle,
} from '../api/paymentExpenseArticlesApi'
import type { PaymentExpenseArticle, PaymentExpenseArticlePayload } from '../types'

type LocationState = {
  returnPath?: string
}

type ArticleFormState = {
  article: PaymentExpenseArticle
  operationName: string
  error: string | null
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  deleteModalOpened: boolean
}

const ARTICLES_PATH = '/accounting/payment-expense-articles'
const PERMISSION_DELETE_EXPENSE_ARTICLE = 'Accounting_Payment_Expense_Articles_Edit_DeleteBtn_PKEY'
const PERMISSION_SAVE_EXPENSE_ARTICLE = 'Accounting_Payment_Expense_Articles_Edit_SaveBtn_PKEY'

export function PaymentExpenseArticleFormPage() {
  const { t } = useI18n()
  const { hasPermission } = useAuth()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || ARTICLES_PATH
  const isEditMode = Boolean(id)
  const [formState, setFormState] = useValueState<ArticleFormState>(() => createInitialFormState(isEditMode))
  const { article, deleteModalOpened, error, isDeleting, isLoading, isSaving, operationName } = formState
  const canDelete = hasPermission(PERMISSION_DELETE_EXPENSE_ARTICLE)
  const canSave = hasPermission(PERMISSION_SAVE_EXPENSE_ARTICLE)

  useEffect(() => {
    if (!id) {
      setFormState((current) => ({
        ...current,
        article: createEmptyArticle(),
        isLoading: false,
        operationName: '',
      }))
      return
    }

    const controller = new AbortController()

    async function loadArticle() {
      setFormState((current) => ({
        ...current,
        error: null,
        isLoading: true,
      }))

      try {
        const nextArticle = await getPaymentExpenseArticle(id as string)

        if (!controller.signal.aborted) {
          setFormState((current) => ({
            ...current,
            article: nextArticle || createEmptyArticle(),
            isLoading: false,
            operationName: nextArticle?.OperationName || '',
          }))
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setFormState((current) => ({
            ...current,
            error: isAbortError(loadError)
              ? current.error
              : loadError instanceof Error
                ? loadError.message
                : t('Не вдалося завантажити статтю витрат'),
            isLoading: false,
          }))
        }
      }
    }

    void loadArticle()

    return () => controller.abort()
  }, [id, setFormState, t])

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
      setFormState((current) => ({ ...current, error: t('Недостатньо прав для збереження') }))
      return
    }

    const trimmedOperationName = operationName.trim()

    if (!trimmedOperationName) {
      setFormState((current) => ({ ...current, error: t('Вкажіть назву статті витрат') }))
      return
    }

    const payload: PaymentExpenseArticlePayload = {
      ...article,
      OperationName: trimmedOperationName,
    }

    setFormState((current) => ({ ...current, error: null, isSaving: true }))

    try {
      const savedArticle = isEditMode
        ? await updatePaymentExpenseArticle(payload)
        : await createPaymentExpenseArticle(payload)

      setFormState((current) => ({
        ...current,
        article: savedArticle || payload,
        isSaving: false,
      }))
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Статтю витрат оновлено') : t('Статтю витрат створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setFormState((current) => ({
        ...current,
        error: saveError instanceof Error ? saveError.message : t('Не вдалося зберегти статтю витрат'),
        isSaving: false,
      }))
    }
  }

  async function handleDelete() {
    if (!canDelete) {
      setFormState((current) => ({ ...current, error: t('Недостатньо прав для видалення') }))
      return
    }

    const netId = article.NetUid || id

    if (!netId) {
      return
    }

    setFormState((current) => ({ ...current, error: null, isDeleting: true }))

    try {
      await deletePaymentExpenseArticle(netId)
      setFormState((current) => ({
        ...current,
        deleteModalOpened: false,
        isDeleting: false,
      }))
      notifications.show({
        color: 'green',
        message: t('Статтю витрат видалено'),
      })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      setFormState((current) => ({
        ...current,
        deleteModalOpened: false,
        error: deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити статтю витрат'),
        isDeleting: false,
      }))
    }
  }

  return (
    <AppDrawer
      opened
      position="right"
      size="standard"
      title={isEditMode ? t('Редагування статті витрат') : t('Нова стаття витрат')}
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
              onClick={() => setFormState((current) => ({ ...current, deleteModalOpened: true }))}
            >
              {t('Видалити')}
            </Button>
          )}
          {canSave && (
            <Button
              color={CREATE_ACTION_COLOR}
              disabled={isLoading}
              form="payment-expense-article-form"
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
      <form id="payment-expense-article-form" onSubmit={handleSubmit}>
        <Stack gap="md">
          {error && (
            <Alert color="red" icon={<CircleAlert size={18} />} variant="light">
              {error}
            </Alert>
          )}

          <TextInput
            disabled={isLoading || isSaving || isDeleting}
            label={t('Назва')}
            placeholder={t('Вкажіть назву')}
            required
            value={operationName}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                operationName: event.currentTarget.value,
              }))
            }
          />
        </Stack>
      </form>

      <AppModal
        centered
        opened={deleteModalOpened}
        title={t('Видалити статтю витрат')}
        onClose={() => setFormState((current) => ({ ...current, deleteModalOpened: false }))}
      >
        <Stack gap="md">
          <Text>
            {t('Видалити статтю')} <Text span fw={600}>{operationName || t('Без назви')}</Text>?
          </Text>
          <Group justify="flex-end">
            <Button
              color="gray"
              disabled={isDeleting}
              variant="light"
              onClick={() => setFormState((current) => ({ ...current, deleteModalOpened: false }))}
            >
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

function createInitialFormState(isLoading: boolean): ArticleFormState {
  return {
    article: createEmptyArticle(),
    deleteModalOpened: false,
    error: null,
    isDeleting: false,
    isLoading,
    isSaving: false,
    operationName: '',
  }
}

function createEmptyArticle(): PaymentExpenseArticle {
  return {
    OperationName: '',
    PaymentCostMovementOperations: [],
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
