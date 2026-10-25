import type { Plugin, TransformResult } from 'vite'

export function transformUiActions(code: string, filename: string, runtimePath: string): TransformResult
export function uiActionGuardPlugin(root?: string): Plugin
