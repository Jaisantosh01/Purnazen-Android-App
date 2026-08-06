/**
 * Shared back helpers — keep navigation from trapping users in deep stacks.
 */

/** True when this navigator's own stack has screens under the current route. */
export function canPopToStackRoot(navigation) {
  const index = navigation?.getState?.()?.index;
  return typeof index === 'number' && index > 0;
}

export function popToStackRoot(navigation) {
  if (!navigation) return;
  // Guard on this stack's index — NOT canGoBack(). canGoBack() is true when a
  // *parent* navigator can go back, which leaves POP_TO_TOP unhandled and
  // logs: "The action 'POP_TO_TOP' was not handled by any navigator."
  if (typeof navigation.popToTop === 'function' && canPopToStackRoot(navigation)) {
    navigation.popToTop();
    return;
  }
  if (navigation.canGoBack?.()) navigation.goBack();
}
