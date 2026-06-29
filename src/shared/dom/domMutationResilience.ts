/**
 * Browser translation tools (Google Translate and friends) and some extensions
 * rewrite text nodes — wrapping them in <font> elements — which detaches the
 * nodes React still holds references to. During its commit phase React then calls
 * `removeChild` / `insertBefore` on a node whose parent has changed and throws
 * `NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be
 * removed is not a child of this node`, crashing the whole view to a white screen.
 *
 * This makes those two native methods tolerant: when the target node is no longer
 * a child of the expected parent, we skip the operation instead of throwing. React
 * reconciliation then stays stable even when the DOM was mutated underneath us, so
 * navigation (client list, product carousel arrow-keys, …) no longer white-screens.
 *
 * The patch only short-circuits the exact illegal case the browser created; every
 * legitimate React DOM operation runs through the original method untouched.
 */
export function installDomMutationResilience(): void {
  if (typeof Node !== 'function' || !Node.prototype) {
    return
  }

  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function patchedRemoveChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      return child
    }

    return originalRemoveChild.call(this, child) as T
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function patchedInsertBefore<T extends Node>(
    this: Node,
    node: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return node
    }

    return originalInsertBefore.call(this, node, referenceNode) as T
  }
}
