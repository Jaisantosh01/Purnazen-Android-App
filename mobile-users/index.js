/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { initCrashReporting } from './src/services/crashReporting';

// Before the component tree exists, so a crash during App's own module
// evaluation or first render is still captured. An ErrorBoundary cannot see
// those — it has to have mounted first.
initCrashReporting();

AppRegistry.registerComponent(appName, () => App);
