import { createNavigationContainerRef } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/routers';

// Root navigation handle for code that lives outside the React tree
// (axios interceptors) and for deeply nested screens that must reach
// the RootStack (logout / account deletion).
export const navigationRef = createNavigationContainerRef();

export function resetToLogin() {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
    );
  }
}
