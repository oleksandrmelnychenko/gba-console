import {
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy, IconTrash } from '@tabler/icons-react'
import { type FormEvent, useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppModal } from '../../../shared/ui/AppModal'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
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

const ARTICLES_PATH = '/accounting/payment-expense-articles'

export function PaymentExpenseArticleFormPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id?: string }>()
  const routeLocation = useLocation()
  const navigate = useNavigate()
  const locationState = routeLocation.state as LocationState | null
  const returnPath = locationState?.returnPath || ARTICLES_PATH
  const isEditMode = Boolean(id)
  const [article, setArticle] = useValueState<PaymentExpenseArticle>(() => createEmptyArticle())
  const [operationName, setOperationName] = useValueState('')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(isEditMode)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)

  useEffect(() => {
    if (!id) {
      setArticle(createEmptyArticle())
      setOperationName('')
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function loadArticle() {
      setLoading(true)
      setError(null)

      try {
        const nextArticle = await getPaymentExpenseArticle(id as string)

        if (!controller.signal.aborted) {
          setArticle(nextArticle || createEmptyArticle())
          setOperationName(nextArticle?.OperationName || '')
        }
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити статтю витрат'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadArticle()

    return () => controller.abort()
  }, [id, setArticle, setError, setLoading, setOperationName, t])

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

    const trimmedOperationName = operationName.trim()

    if (!trimmedOperationName) {
      setError(t('Вкажіть назву статті витрат'))
      return
    }

    const payload: PaymentExpenseArticlePayload = {
      ...article,
      OperationName: trimmedOperationName,
    }

    setSaving(true)
    setError(null)

    try {
      const savedArticle = isEditMode
        ? await updatePaymentExpenseArticle(payload)
        : await createPaymentExpenseArticle(payload)

      setArticle(savedArticle || payload)
      notifications.show({
        color: 'green',
        message: isEditMode ? t('Статтю витрат оновлено') : t('Статтю витрат створено'),
      })
      navigate(returnPath, { replace: true })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти статтю витрат'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const netId = article.NetUid || id

    if (!netId) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deletePaymentExpenseArticle(netId)
      notifications.show({
        color: 'green',
        message: t('Статтю витрат видалено'),
      })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити статтю витрат'))
    } finally {
      setDeleting(false)
      setDeleteModalOpened(false)
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" shadow="sm">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Text fw={700} size="xl">
                  {isEditMode ? t('Редагування статті витрат') : t('Нова стаття витрат')}
                </Text>
              </div>

              <Group gap="xs">
                <Button
                  color="gray"
                  leftSection={<IconArrowLeft size={16} />}
                  type="button"
                  variant="light"
                  onClick={handleCancel}
                >
                  {t('Назад')}
                </Button>
                {isEditMode && (
                  <Button
                    color="red"
                    disabled={isLoading}
                    leftSection={<IconTrash size={16} />}
                    loading={isDeleting}
                    type="button"
                    variant="light"
                    onClick={() => setDeleteModalOpened(true)}
                  >
                    {t('Видалити')}
                  </Button>
                )}
                <Button
                  color="violet"
                  disabled={isLoading}
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={isSaving}
                  type="submit"
                >
                  {t('Зберегти')}
                </Button>
              </Group>
            </Group>

            {error && (
              <Alert color="red" icon={<IconAlertCircle size={18} />} variant="light">
                {error}
              </Alert>
            )}

            <TextInput
              disabled={isLoading || isSaving || isDeleting}
              label={t('Назва')}
              placeholder={t('Вкажіть назву')}
              required
              value={operationName}
              onChange={(event) => setOperationName(event.currentTarget.value)}
            />
          </Stack>
        </form>
      </Card>

      <AppModal
        centered
        opened={deleteModalOpened}
        title={t('Видалити статтю витрат')}
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
            <Button color="red" leftSection={<IconTrash size={16} />} loading={isDeleting} onClick={handleDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </AppModal>
    </Stack>
  )
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
