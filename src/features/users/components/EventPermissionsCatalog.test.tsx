import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../shared/i18n/I18nProvider'
import { AUTH_PERMISSIONS_CHANGED_EVENT } from '../../../shared/auth/permissionEvents'
import {
  getEventPermissionCatalog,
  getRoleEventPermissions,
  updateRoleEventPermissions,
  type EventPermissionDefinition,
} from '../api/eventPermissionsApi'
import {
  EventPermissionsCatalog,
  type EventPermissionsCatalogHandle,
} from './EventPermissionsCatalog'

vi.mock('../api/eventPermissionsApi', () => ({
  getEventPermissionCatalog: vi.fn(),
  getRoleEventPermissions: vi.fn(),
  updateRoleEventPermissions: vi.fn(),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

const mockedGetCatalog = vi.mocked(getEventPermissionCatalog)
const mockedGetRolePermissions = vi.mocked(getRoleEventPermissions)
const mockedUpdateRolePermissions = vi.mocked(updateRoleEventPermissions)
const mockedNotificationsShow = vi.mocked(notifications.show)

describe('EventPermissionsCatalog', () => {
  beforeEach(() => {
    mockedGetCatalog.mockReset()
    mockedGetRolePermissions.mockReset()
    mockedUpdateRolePermissions.mockReset()
    mockedNotificationsShow.mockReset()

    try {
      window.sessionStorage.removeItem('gba.event-permissions.expanded.v1')
    } catch {
      // The test runtime may disable web storage.
    }

    mockedGetCatalog.mockResolvedValue({
      catalogVersion: 'catalog-1',
      permissions: [
        {
          active: true,
          controlType: 'mutation',
          groupId: 'sale-actions',
          groupLabel: 'Дії з продажем',
          key: 'sales.ukraine.sale.edit',
          name: 'Редагувати продаж',
          pageId: 'sales.ukraine.all',
          pageLabel: 'Усі продажі України',
          risk: 'high',
          route: '/sales/ukraine/all',
          sectionId: 'sales',
          sectionLabel: 'Продажі',
        },
      ],
    })
    mockedGetRolePermissions.mockResolvedValue({
      catalogVersion: 'catalog-1',
      permissionKeys: [],
      roleNetUid: 'role-1',
      version: 3,
    })
    mockedUpdateRolePermissions.mockResolvedValue({
      catalogVersion: 'catalog-1',
      permissionKeys: ['sales.ukraine.sale.edit'],
      roleNetUid: 'role-1',
      version: 4,
    })
  })

  it('selects and clears the full catalog independently, then saves the server readback', async () => {
    const editorRef = createRef<EventPermissionsCatalogHandle>()
    const onDirtyChange = vi.fn()
    const onPermissionsChanged = vi.fn()
    window.addEventListener(AUTH_PERMISSIONS_CHANGED_EVENT, onPermissionsChanged)

    render(
      <MantineProvider env="test">
        <I18nProvider>
          <EventPermissionsCatalog
            ref={editorRef}
            role={{ Name: 'Менеджер', NetUid: 'role-1' }}
            onDirtyChange={onDirtyChange}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Продажі')).not.toBeNull()

    const selectAll = screen.getByRole('button', { name: 'Вибрати все' })
    const clearAll = screen.getByRole('button', { name: 'Очистити' })

    expect((clearAll as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(selectAll)
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

    expect((selectAll as HTMLButtonElement).disabled).toBe(true)
    expect((clearAll as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(clearAll)
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))

    fireEvent.click(selectAll)
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

    await act(async () => {
      await editorRef.current?.save()
    })

    expect(mockedUpdateRolePermissions).toHaveBeenCalledWith(
      'role-1',
      3,
      ['sales.ukraine.sale.edit'],
    )
    expect(onPermissionsChanged).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
    window.removeEventListener(AUTH_PERMISSIONS_CHANGED_EVENT, onPermissionsChanged)
  })

  it('keeps event assignments read-only without the edit permission', async () => {
    const editorRef = createRef<EventPermissionsCatalogHandle>()

    render(
      <MantineProvider env="test">
        <I18nProvider>
          <EventPermissionsCatalog
            ref={editorRef}
            readOnly
            role={{ Name: 'Перегляд', NetUid: 'role-1' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Продажі')).not.toBeNull()
    expect((screen.getByRole('button', { name: 'Вибрати все' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: /Вибрати розділ/ }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      await editorRef.current?.save()
    })

    expect(mockedUpdateRolePermissions).not.toHaveBeenCalled()
  })

  it('treats every canonical right as editable even if the API sends an obsolete inherited marker', async () => {
    const editorRef = createRef<EventPermissionsCatalogHandle>()
    mockedGetRolePermissions.mockResolvedValue({
      catalogVersion: 'catalog-1',
      inheritedPermissionKeys: ['sales.ukraine.sale.edit'],
      permissionKeys: ['sales.ukraine.sale.edit'],
      roleNetUid: 'role-legacy',
      version: 2,
    })

    render(
      <MantineProvider env="test">
        <I18nProvider>
          <EventPermissionsCatalog
            ref={editorRef}
            role={{ Name: 'Legacy роль', NetUid: 'role-legacy' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    expect(await screen.findByText('Продажі')).not.toBeNull()
    expect(screen.queryByText('Успадковані історичні права', { exact: false })).toBeNull()

    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук права' }), {
      target: { value: 'sales.ukraine.sale.edit' },
    })
    const permissionCheckbox = await screen.findByRole('checkbox', {
      name: 'Вибрати право: Редагувати продаж (sales.ukraine.sale.edit)',
    })

    expect((permissionCheckbox as HTMLButtonElement).disabled).toBe(false)
    expect(permissionCheckbox.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(permissionCheckbox)
    expect(permissionCheckbox.getAttribute('aria-checked')).toBe('false')

    await act(async () => {
      await editorRef.current?.save()
    })

    expect(mockedUpdateRolePermissions).toHaveBeenCalledWith(
      'role-legacy',
      2,
      [],
    )
  })

  it('keeps a 1920-permission catalog lazy while preserving search and batch semantics', async () => {
    const permissions = createLargeCatalog()
    mockedGetCatalog.mockResolvedValue({
      catalogVersion: 'large-1',
      permissions,
    })
    mockedGetRolePermissions.mockResolvedValue({
      catalogVersion: 'large-1',
      permissionKeys: [],
      roleNetUid: 'role-large',
      version: 1,
    })

    const renderStartedAt = performance.now()
    render(
      <MantineProvider env="test">
        <I18nProvider>
          <EventPermissionsCatalog
            role={{ Name: 'Велика роль', NetUid: 'role-large' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    const firstPage = await screen.findByText('Сторінка 0-0')
    const initialRenderMs = performance.now() - renderStartedAt

    expect(initialRenderMs).toBeLessThan(5_000)
    expect(screen.queryAllByRole('checkbox', { name: /^Вибрати право:/ })).toHaveLength(0)

    const pageNode = firstPage.closest('.role-tree-node')
    expect(pageNode).not.toBeNull()
    fireEvent.click(within(pageNode as HTMLElement).getByRole('button', { name: /^Розгорнути:/ }))

    const firstGroup = await screen.findByText('Група 0-0-0')
    expect(screen.queryAllByRole('checkbox', { name: /^Вибрати право:/ })).toHaveLength(0)

    const groupNode = firstGroup.closest('.event-role-tree-group')
    expect(groupNode).not.toBeNull()
    fireEvent.click(within(groupNode as HTMLElement).getByRole('button', { name: /^Розгорнути:/ }))
    await waitFor(() =>
      expect(screen.queryAllByRole('checkbox', { name: /^Вибрати право:/ })).toHaveLength(5),
    )

    const selectStartedAt = performance.now()
    fireEvent.click(screen.getByRole('button', { name: 'Вибрати все' }))
    expect(await screen.findByText('Права: 1920/1920')).not.toBeNull()
    const selectAllMs = performance.now() - selectStartedAt
    expect(selectAllMs).toBeLessThan(3_000)

    fireEvent.click(screen.getByRole('button', { name: 'Очистити' }))
    expect(await screen.findByText('Права: 0/1920')).not.toBeNull()

    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук права' }), {
      target: { value: 'Дія 15-7-2-4' },
    })

    expect(await screen.findByText('Дія 15-7-2-4')).not.toBeNull()
    await waitFor(() =>
      expect(screen.queryAllByRole('checkbox', { name: /^Вибрати право:/ })).toHaveLength(1),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Вибрати показані' }))
    expect(await screen.findByText('Права: 1/1920')).not.toBeNull()

    console.info(
      `[event-permissions-perf] initial ${permissions.length} rights: ${initialRenderMs.toFixed(1)}ms; select-all: ${selectAllMs.toFixed(1)}ms`,
    )
  }, 15_000)

  it('saves equally named controls independently by canonical key and applies each readback', async () => {
    const firstKey = 'sales.ukraine.sale.open_create_dialog'
    const secondKey = 'orders.ukraine.order.open_create_dialog'
    mockedGetCatalog.mockResolvedValue({
      catalogVersion: 'same-name-1',
      permissions: [
        createSameNamePermission({
          key: firstKey,
          pageId: 'sales.ukraine.all',
          pageLabel: 'Усі продажі України',
          route: '/sales/ukraine/all',
          sectionId: 'sales',
          sectionLabel: 'Продажі',
        }),
        createSameNamePermission({
          key: secondKey,
          pageId: 'orders.ukraine.all',
          pageLabel: 'Усі замовлення України',
          route: '/orders/ukraine/all',
          sectionId: 'orders',
          sectionLabel: 'Замовлення',
        }),
      ],
    })
    mockedGetRolePermissions.mockResolvedValue({
      catalogVersion: 'same-name-1',
      permissionKeys: [],
      roleNetUid: 'role-same-name',
      version: 3,
    })
    mockedUpdateRolePermissions
      .mockReset()
      .mockResolvedValueOnce({
        catalogVersion: 'same-name-1',
        permissionKeys: [firstKey],
        roleNetUid: 'role-same-name',
        version: 4,
      })
      .mockResolvedValueOnce({
        catalogVersion: 'same-name-1',
        permissionKeys: [secondKey],
        roleNetUid: 'role-same-name',
        version: 5,
      })

    const editorRef = createRef<EventPermissionsCatalogHandle>()
    render(
      <MantineProvider env="test">
        <I18nProvider>
          <EventPermissionsCatalog
            ref={editorRef}
            role={{ Name: 'Однакові назви', NetUid: 'role-same-name' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByText('Продажі')
    fireEvent.change(screen.getByRole('textbox', { name: 'Пошук права' }), {
      target: { value: 'Створити' },
    })

    const firstRow = (await screen.findByText(firstKey)).closest('.role-tree-permission')
    const secondRow = (await screen.findByText(secondKey)).closest('.role-tree-permission')
    expect(firstRow).not.toBeNull()
    expect(secondRow).not.toBeNull()

    const firstCheckbox = await screen.findByRole('checkbox', {
      name: `Вибрати право: Створити (${firstKey})`,
    })
    const secondCheckbox = await screen.findByRole('checkbox', {
      name: `Вибрати право: Створити (${secondKey})`,
    })

    expect(firstCheckbox.tagName).toBe('BUTTON')
    expect(secondCheckbox.tagName).toBe('BUTTON')

    fireEvent.click(firstCheckbox)
    expect(firstCheckbox.getAttribute('aria-checked')).toBe('true')
    expect(secondCheckbox.getAttribute('aria-checked')).toBe('false')

    await act(async () => {
      await editorRef.current?.save()
    })

    expect(mockedUpdateRolePermissions).toHaveBeenNthCalledWith(
      1,
      'role-same-name',
      3,
      [firstKey],
    )
    expect(firstCheckbox.getAttribute('aria-checked')).toBe('true')
    expect(secondCheckbox.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(firstCheckbox)
    fireEvent.click(secondCheckbox)
    expect(firstCheckbox.getAttribute('aria-checked')).toBe('false')
    expect(secondCheckbox.getAttribute('aria-checked')).toBe('true')

    await act(async () => {
      await editorRef.current?.save()
    })

    expect(mockedUpdateRolePermissions).toHaveBeenNthCalledWith(
      2,
      'role-same-name',
      4,
      [secondKey],
    )
    expect(firstCheckbox.getAttribute('aria-checked')).toBe('false')
    expect(secondCheckbox.getAttribute('aria-checked')).toBe('true')
  })

  it('keeps failed changes dirty, shows the error and never reports a false success', async () => {
    mockedUpdateRolePermissions.mockRejectedValue(
      new Error('Сервер відхилив зміни'),
    )
    const editorRef = createRef<EventPermissionsCatalogHandle>()
    const onDirtyChange = vi.fn()

    render(
      <MantineProvider env="test">
        <I18nProvider>
          <EventPermissionsCatalog
            ref={editorRef}
            role={{ Name: 'Менеджер', NetUid: 'role-1' }}
            onDirtyChange={onDirtyChange}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByText('Продажі')
    fireEvent.click(screen.getByRole('button', { name: 'Вибрати все' }))
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

    await act(async () => {
      await editorRef.current?.save()
    })

    expect(await screen.findByText('Сервер відхилив зміни')).not.toBeNull()
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(mockedUpdateRolePermissions).toHaveBeenCalledWith(
      'role-1',
      3,
      ['sales.ukraine.sale.edit'],
    )
    expect(mockedNotificationsShow).not.toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green', message: 'Збережено' }),
    )
  })

  it('ignores a late save response after a fast tab-style unmount', async () => {
    let resolveSave: ((value: Awaited<ReturnType<typeof updateRoleEventPermissions>>) => void) | undefined
    mockedUpdateRolePermissions.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve
      }),
    )
    const editorRef = createRef<EventPermissionsCatalogHandle>()
    const onSavingChange = vi.fn()
    const view = render(
      <MantineProvider env="test">
        <I18nProvider>
          <EventPermissionsCatalog
            ref={editorRef}
            role={{ Name: 'Менеджер', NetUid: 'role-1' }}
            onSavingChange={onSavingChange}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    await screen.findByText('Продажі')
    fireEvent.click(screen.getByRole('button', { name: 'Вибрати все' }))

    let savePromise: Promise<void> | undefined
    act(() => {
      savePromise = editorRef.current?.save()
    })
    await waitFor(() => expect(editorRef.current?.isSaving()).toBe(true))
    expect(onSavingChange).toHaveBeenLastCalledWith(true)

    view.unmount()
    await act(async () => {
      resolveSave?.({
        catalogVersion: 'catalog-1',
        permissionKeys: ['sales.ukraine.sale.edit'],
        roleNetUid: 'role-1',
        version: 4,
      })
      await savePromise
    })

    expect(onSavingChange).toHaveBeenLastCalledWith(false)
    expect(mockedNotificationsShow).not.toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green', message: 'Збережено' }),
    )
  })

  it('aborts an in-flight role GET when the editor unmounts', async () => {
    let requestSignal: AbortSignal | undefined
    mockedGetRolePermissions.mockImplementation((_roleNetUid, signal) => {
      requestSignal = signal
      return new Promise(() => undefined)
    })

    const view = render(
      <MantineProvider env="test">
        <I18nProvider>
          <EventPermissionsCatalog
            role={{ Name: 'Менеджер', NetUid: 'role-1' }}
          />
        </I18nProvider>
      </MantineProvider>,
    )

    await waitFor(() => expect(mockedGetRolePermissions).toHaveBeenCalled())
    expect(requestSignal?.aborted).toBe(false)

    view.unmount()
    expect(requestSignal?.aborted).toBe(true)
  })
})

function createSameNamePermission(
  overrides: Pick<
    EventPermissionDefinition,
    'key' | 'pageId' | 'pageLabel' | 'route' | 'sectionId' | 'sectionLabel'
  >,
): EventPermissionDefinition {
  return {
    active: true,
    controlType: 'navigation',
    description: 'Відкриває форму створення',
    groupId: 'create-actions',
    groupLabel: 'Створення',
    name: 'Створити',
    risk: 'low',
    ...overrides,
  }
}

function createLargeCatalog(): EventPermissionDefinition[] {
  const permissions: EventPermissionDefinition[] = []

  for (let section = 0; section < 16; section += 1) {
    for (let page = 0; page < 8; page += 1) {
      for (let group = 0; group < 3; group += 1) {
        for (let permission = 0; permission < 5; permission += 1) {
          permissions.push({
            active: true,
            controlType: permission % 2 === 0 ? 'mutation' : 'navigation',
            description: `Опис дії ${section}-${page}-${group}-${permission}`,
            groupId: `group-${section}-${page}-${group}`,
            groupLabel: `Група ${section}-${page}-${group}`,
            key: `section${section}.page${page}.group${group}.action${permission}`,
            name: `Дія ${section}-${page}-${group}-${permission}`,
            pageId: `page-${section}-${page}`,
            pageLabel: `Сторінка ${section}-${page}`,
            risk: permission % 3 === 0 ? 'high' : permission % 3 === 1 ? 'medium' : 'low',
            route: `/section-${section}/page-${page}`,
            sectionId: `section-${section}`,
            sectionLabel: `Розділ ${section}`,
          })
        }
      }
    }
  }

  return permissions
}
