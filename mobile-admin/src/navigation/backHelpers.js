/**
 * Shared back helpers — keep navigation from trapping users in deep stacks.
 */
export function popToStackRoot(navigation) {
  if (!navigation) return;
  if (typeof navigation.popToTop === 'function' && navigation.canGoBack?.()) {
    navigation.popToTop();
    return;
  }
  if (navigation.canGoBack?.()) navigation.goBack();
}
