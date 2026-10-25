import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
import { uiActionGuardPlugin, transformUiActions } from './ui-action-guard-plugin.mjs'

// Execute transformed application source: track real discarded results, preserve
// expression order, return values and JSX props instead of asserting printer text.
const runtime = 'data:text/javascript,' + encodeURIComponent(`
  export const captured = [];
  export const wrapped = [];
  export function trackUiActionResult(value) { captured.push(value); return value }
  export function guardUiAction(handler) { wrapped.push(handler); return handler }
  export function guardUiActionProps(props) { if (props.onClick) wrapped.push(props.onClick); return props }
`)

async function compile(source) {
  const transformed = transformUiActions(source, 'fixture.tsx', runtime)
  const javascript = ts.transpileModule(transformed.code, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, jsxFactory: 'element' },
  }).outputText
  return import('data:text/javascript,' + encodeURIComponent(javascript))
}

test('new JSX handlers, spread props and discarded calls retain normal execution semantics', async () => {
  const { captured, wrapped } = await import(runtime)
  const module = await compile(`
    const order = [];
    function element(tag, props) { return { tag, props } }
    function work() { order.push('work'); return Promise.resolve('saved') }
    function helper() { work() }
    const button = <button onClick={() => { helper(); void work(); order.push('closed') }} />;
    const spread = <button {...{ onClick: work }} />;
    export { button, spread, order };
  `)
  module.button.props.onClick()
  assert.deepEqual(module.order, ['work', 'work', 'closed'])
  assert.equal(captured.filter(value => value instanceof Promise).length, 2)
  assert.equal(wrapped.length, 2)
  assert.equal(await module.spread.props.onClick(), 'saved')
})

test('void expressions preserve undefined when used as values', async () => {
  const module = await compile('export const result = void Promise.resolve(7)')
  assert.equal(module.result, undefined)
})

test('only application sources are transformed; runtime and dependencies stay untouched', () => {
  const plugin = uiActionGuardPlugin('/repo')
  for (const filename of ['/repo/node_modules/lib/index.tsx', '/repo/src/Example.test.tsx', '/repo/src/test/setup.ts', '/repo/src/shared/ui/action-guard/uiActionGuard.ts']) {
    assert.equal(plugin.transform('work()', filename), null)
  }
  assert.ok(plugin.transform('export function action() { void work() }', '/repo/src/new-feature/actions.ts'))
})
