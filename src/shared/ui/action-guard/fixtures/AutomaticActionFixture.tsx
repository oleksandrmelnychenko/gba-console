import { ActionIcon, Button, MantineProvider, Menu } from '@mantine/core'
import { useState, type ComponentProps } from 'react'

function discardInHelper(work: () => Promise<void>) {
  work()
}

function CustomButton(props: ComponentProps<'button'>) {
  return <button {...props} />
}

export function AutomaticActionFixture({ work, after = () => undefined, other = async () => undefined }: {
  work: () => Promise<void>
  after?: () => void
  other?: () => Promise<void>
}) {
  const [count, setCount] = useState(0)
  const spread = { onClick: work }
  return <MantineProvider env="test">
    <button onClick={async () => { await work(); after() }}>Native</button>
    <Button onClick={() => void work()}>Mantine</Button>
    <ActionIcon aria-label="Icon" onClick={() => { work() }}><span>+</span></ActionIcon>
    <button onClick={() => discardInHelper(work)}>Nested void</button>
    <button onClick={() => { work(); other(); after() }}>Parallel</button>
    <button onClick={() => { discardInHelper(work); setCount(value => value + 1) }}>Rerender {count}</button>
    <button onClick={() => setCount(value => value + 1)}>Sync {count}</button>
    <CustomButton {...spread}>Spread</CustomButton>
    <Menu opened><Menu.Dropdown><Menu.Item onClick={() => void work()}>Menu action</Menu.Item></Menu.Dropdown></Menu>
    <form id="automatic-test-form" aria-label="Editor" onSubmit={event => { event.preventDefault(); discardInHelper(work) }}>
      <input aria-label="Value" name="value" defaultValue="retained" />
      <button type="submit">Submit</button>
      <button type="button" onClick={after}>Cancel</button>
    </form>
    <button type="submit" form="automatic-test-form">External submit</button>
  </MantineProvider>
}
