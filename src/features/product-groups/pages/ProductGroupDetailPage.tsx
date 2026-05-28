import {
  Alert,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCheck,
  IconChevronLeft,
  IconDeviceFloppy,
  IconTrash,
} from '@tabler/icons-react'
import { type FormEvent, useEffect, useMemo } from 'react'
import { useValueState } from '../../../shared/hooks/useValueState'
import { useI18n } from '../../../shared/i18n/useI18n'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  deleteProductGroup,
  getProductGroupWithRoot,
  getRootProductGroups,
  updateProductGroup,
} from '../api/productGroupsApi'
import { ProductGroupForm } from '../components/ProductGroupForm'
import { ProductGroupProductsPanel } from '../components/ProductGroupProductsPanel'
import { ProductGroupSubGroupsPanel } from '../components/ProductGroupSubGroupsPanel'
import type { ProductGroup } from '../types'
import {
  buildRootProductGroupChanges,
  getCurrentRootProductGroup,
  getProductGroupName,
  normalizeProductGroupForSave,
  validateProductGroup,
} from '../utils'

type ProductGroupContentTab = 'products' | 'subGroups'

type ProductGroupDetailRouteState = {
  returnPath?: string
}

export function ProductGroupDetailPage() {
  const { t } = useI18n()
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as ProductGroupDetailRouteState | null
  const returnPath = routeState?.returnPath || '/product-groups'
  const [productGroup, setProductGroup] = useValueState<ProductGroup | null>(null)
  const [formProductGroup, setFormProductGroup] = useValueState<ProductGroup | null>(null)
  const [rootGroups, setRootGroups] = useValueState<ProductGroup[]>([])
  const [selectedRootNetUid, setSelectedRootNetUid] = useValueState<string | null>(null)
  const [activeTab, setActiveTab] = useValueState<ProductGroupContentTab>('subGroups')
  const [error, setError] = useValueState<string | null>(null)
  const [isLoading, setLoading] = useValueState(true)
  const [isSaving, setSaving] = useValueState(false)
  const [isDeleting, setDeleting] = useValueState(false)
  const [isLoadingRootGroups, setLoadingRootGroups] = useValueState(true)
  const [deleteModalOpened, setDeleteModalOpened] = useValueState(false)
  const rootGroupsForForm = useMemo(() => {
    const currentRootProductGroup = getCurrentRootProductGroup(productGroup)

    if (
      currentRootProductGroup?.NetUid &&
      !rootGroups.some((rootGroup) => rootGroup.NetUid === currentRootProductGroup.NetUid)
    ) {
      return [currentRootProductGroup, ...rootGroups]
    }

    return rootGroups
  }, [productGroup, rootGroups])

  useEffect(() => {
    if (!id) {
      return
    }

    const productGroupNetId = id
    let cancelled = false

    async function loadProductGroup() {
      setLoading(true)
      setLoadingRootGroups(true)
      setError(null)

      try {
        const [nextProductGroup, nextRootGroups] = await Promise.all([
          getProductGroupWithRoot(productGroupNetId),
          getRootProductGroups(productGroupNetId),
        ])

        if (!cancelled) {
          setProductGroup(nextProductGroup)
          setFormProductGroup(nextProductGroup)
          setRootGroups(nextRootGroups)
          setSelectedRootNetUid(getCurrentRootProductGroup(nextProductGroup)?.NetUid || null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setProductGroup(null)
          setFormProductGroup(null)
          setRootGroups([])
          setSelectedRootNetUid(null)
          setError(loadError instanceof Error ? loadError.message : t('Не вдалося завантажити групу товарів'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingRootGroups(false)
        }
      }
    }

    void loadProductGroup()

    return () => {
      cancelled = true
    }
  }, [id, setError, setFormProductGroup, setLoading, setLoadingRootGroups, setProductGroup, setRootGroups, setSelectedRootNetUid, t])

  if (!id) {
    return <Navigate to="/product-groups" replace />
  }

  function setField<TKey extends keyof ProductGroup>(key: TKey, value: ProductGroup[TKey]) {
    setFormProductGroup((currentProductGroup) =>
      currentProductGroup
        ? {
            ...currentProductGroup,
            [key]: value,
          }
        : currentProductGroup,
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!productGroup || !formProductGroup) {
      return
    }

    const selectedRootProductGroup =
      rootGroupsForForm.find((rootGroup) => rootGroup.NetUid === selectedRootNetUid) || null
    const rootProductGroups = buildRootProductGroupChanges(productGroup, selectedRootProductGroup)
    const payload = normalizeProductGroupForSave(formProductGroup, rootProductGroups)
    const validationError = validateProductGroup(payload)

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updatedProductGroup = await updateProductGroup(payload)
      const nextProductGroup = updatedProductGroup || payload

      setProductGroup(nextProductGroup)
      setFormProductGroup(nextProductGroup)
      setSelectedRootNetUid(getCurrentRootProductGroup(nextProductGroup)?.NetUid || null)
      notifications.show({
        color: 'green',
        message: t('Групу товарів збережено'),
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('Не вдалося зберегти групу товарів'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!productGroup?.NetUid) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteProductGroup(productGroup.NetUid)
      notifications.show({
        color: 'green',
        message: t('Групу товарів видалено'),
      })
      navigate(returnPath, { replace: true })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('Не вдалося видалити групу товарів'))
    } finally {
      setDeleting(false)
      setDeleteModalOpened(false)
    }
  }

  function closeSheet() {
    if (isSaving || isDeleting) {
      return
    }

    navigate(returnPath, { replace: true })
  }

  return (
    <Drawer
      opened
      closeOnClickOutside={!isSaving && !isDeleting}
      keepMounted={false}
      position="right"
      size="min(900px, 100vw)"
      onClose={closeSheet}
    >
    <Stack gap="lg">
      <Group justify="space-between" align="start">
        <div />
        <Group gap="xs">
          <Button
            color="gray"
            leftSection={<IconChevronLeft size={16} />}
            type="button"
            variant="light"
            onClick={closeSheet}
          >
            {t('Скасувати')}
          </Button>
          <Button
            color="red"
            disabled={!productGroup}
            leftSection={<IconTrash size={16} />}
            loading={isDeleting}
            type="button"
            variant="light"
            onClick={() => setDeleteModalOpened(true)}
          >
            {t('Видалити')}
          </Button>
          <Button
            color="violet"
            disabled={!formProductGroup}
            form="product-group-edit-form"
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

      {isLoading ? (
        <Card withBorder radius="md" padding="lg">
          <Group justify="center" py="xl">
            <Loader color="violet" size="sm" />
            <Text c="dimmed" size="sm">
              {t('Завантаження групи товарів')}
            </Text>
          </Group>
        </Card>
      ) : formProductGroup ? (
        <form id="product-group-edit-form" onSubmit={handleSubmit}>
          <Card withBorder radius="md" padding="md">
            <ProductGroupForm
              disabled={isSaving || isDeleting}
              isLoadingRootGroups={isLoadingRootGroups}
              productGroup={formProductGroup}
              rootGroups={rootGroupsForForm}
              selectedRootNetUid={selectedRootNetUid}
              onFieldChange={setField}
              onRootGroupChange={setSelectedRootNetUid}
            />
          </Card>
        </form>
      ) : (
        <Card withBorder radius="md" padding="lg">
          <Text c="dimmed">{t('Групу товарів не знайдено')}</Text>
        </Card>
      )}

      {productGroup?.NetUid && (
        <Card withBorder radius="md" padding="md">
          <div className="pill-tabs" style={{ width: 'fit-content', marginBottom: 'var(--mantine-spacing-md)' }}>
            {([
              { value: 'subGroups', label: t('Підгрупи') },
              { value: 'products', label: t('Товари') },
            ] as const).map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`pill-tab${activeTab === tab.value ? ' is-active' : ''}`}
                aria-pressed={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'subGroups' && <ProductGroupSubGroupsPanel productGroupNetId={productGroup.NetUid} />}
          {activeTab === 'products' && <ProductGroupProductsPanel productGroupNetId={productGroup.NetUid} />}
        </Card>
      )}

      <Modal
        centered
        opened={deleteModalOpened}
        title={t('Видалити групу товарів')}
        onClose={() => setDeleteModalOpened(false)}
      >
        <Stack gap="md">
          <Text size="sm">{t('Підтвердити видалення')}: {productGroup ? getProductGroupName(productGroup) : ''}</Text>
          <Group justify="flex-end">
            <Button color="gray" type="button" variant="subtle" onClick={() => setDeleteModalOpened(false)}>
              {t('Скасувати')}
            </Button>
            <Button color="red" leftSection={<IconCheck size={16} />} loading={isDeleting} type="button" onClick={handleDelete}>
              {t('Видалити')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
    </Drawer>
  )
}
