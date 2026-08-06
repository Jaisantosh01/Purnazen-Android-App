/**
 * Shared back helpers — keep navigation from trapping users in deep stacks.
 *
 * Use popToStackRoot when the screen is a browse/leaf destination (history,
 * results, settings, …) and state does not need to be preserved. Keep
 * navigation.goBack() for multi-step wizards (booking, editors, …).
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

/**
 * Tab re-press listener: if the tapped tab is already focused but its stack
 * is deep, reset to that tab's root screen in one step.
 */
export function makeTabPressResetListener(navigationRef, routeName, rootScreenName) {
  return () => ({
    tabPress: () => {
      if (!navigationRef?.isReady?.()) return;
      const rootState = navigationRef.getRootState?.();
      if (!rootState) return;
      const mainRoute = rootState.routes.find(r => r.name === 'Main') || rootState.routes[0];
      const tabState = mainRoute?.state;
      if (!tabState) return;
      const tabRoute = tabState.routes.find(r => r.name === routeName);
      const childState = tabRoute?.state;
      if (!childState) return;
      const isRootVisible =
        childState.index === 0 && childState.routes[0]?.name === rootScreenName;
      if (isRootVisible) return;
      const targetKey = childState.key;
      if (!targetKey) return;
      const { CommonActions } = require('@react-navigation/native');
      navigationRef.dispatch({
        ...CommonActions.reset({ index: 0, routes: [{ name: rootScreenName }] }),
        target: targetKey,
      });
    },
  });
}
