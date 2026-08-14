import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CommonActions } from '@react-navigation/routers';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// @ts-ignore
import authService from './src/services/authService';
// @ts-ignore
import biometricService from './src/services/biometricService';
// @ts-ignore
import { useAuthStore } from './src/store/authStore';
// @ts-ignore
import { navigationRef } from './src/navigation/navigationRef';
// @ts-ignore
import { COLORS } from './src/constants/theme';
// @ts-ignore
import useTheme from './src/hooks/useTheme';
// @ts-ignore
import { useThemeStore } from './src/store/themeStore';
// @ts-ignore
import Toast from './src/components/Toast';
// @ts-ignore
import AppAlertHost from './src/components/AppAlertHost';
// @ts-ignore
import UpdatePrompt from './src/components/UpdatePrompt';
// @ts-ignore
import useToastStore from './src/utils/toast';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import UnifiedUserDoctorScreen from './src/screens/UnifiedUserDoctorScreen';
import DoctorDetailScreen from './src/screens/DoctorDetailScreen';
import EditDoctorScreen from './src/screens/EditDoctorScreen';
import ClinicAddressPickerScreen from './src/screens/ClinicAddressPickerScreen';
import MetadataManagementScreen from './src/screens/MetadataManagementScreen';
import EditUserScreen from './src/screens/EditUserScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import ContentViewerScreen from './src/screens/ContentViewerScreen';
import AppointmentManagementScreen from './src/screens/AppointmentManagementScreen';
import SlotManagementScreen from './src/screens/SlotManagementScreen';
import DoctorLeaveManagementScreen from './src/screens/DoctorLeaveManagementScreen';
import VideoManagementScreen from './src/screens/VideoManagementScreen';
import VideoGroupDetailScreen from './src/screens/VideoGroupDetailScreen';
import VideoGroupEditorScreen from './src/screens/VideoGroupEditorScreen';
import UploadVideoScreen from './src/screens/UploadVideoScreen';
import FaqManagementScreen from './src/screens/FaqManagementScreen';
import NotificationAdminScreen from './src/screens/NotificationAdminScreen';
import ContentManagementScreen from './src/screens/ContentManagementScreen';
import ContentDetailScreen from './src/screens/ContentDetailScreen';
import ContentEditorScreen from './src/screens/ContentEditorScreen';
import TaxSettingsScreen from './src/screens/TaxSettingsScreen';
import ManageScreen from './src/screens/ManageScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const ManageStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home:    { active: 'home',           inactive: 'home-outline'           },
  Manage:  { active: 'view-grid',      inactive: 'view-grid-outline'      },
  Profile: { active: 'account-circle', inactive: 'account-circle-outline' },
};

const TAB_ROOT_SCREENS: Record<string, string> = {
  Home:    'HomeMain',
  Manage:  'ManageMain',
  Profile: 'ProfileMain',
};

const makeTabListener = (routeName: string) => () => ({
  tabPress: () => {
    if (!navigationRef.isReady()) return;
    const rootState = navigationRef.getRootState();
    if (!rootState) return;
    const mainRoute = rootState.routes[0];
    const tabState = mainRoute?.state;
    if (!tabState) return;
    const tabRoute = tabState.routes.find((r: any) => r.name === routeName);
    const childState = tabRoute?.state;
    if (!childState) return;
    const rootName = TAB_ROOT_SCREENS[routeName];
    const isRootVisible =
      childState.index === 0 && childState.routes[0]?.name === rootName;
    if (isRootVisible) return;
    const targetKey = childState.key;
    if (!targetKey) return;
    navigationRef.dispatch({
      ...CommonActions.reset({ index: 0, routes: [{ name: rootName }] }),
      target: targetKey,
    });
  },
});

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      {/* Dashboard cards deep-link into the Manage tab, so only the dashboard
          itself lives in this stack. */}
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
    </HomeStack.Navigator>
  );
}

// Every management area is grouped under the Manage tab: the hub screen lists
// them by domain (People / Scheduling / Content) and the detail screens stack
// on top so back always returns to the hub.
function ManageStackNavigator() {
  return (
    <ManageStack.Navigator screenOptions={{ headerShown: false }}>
      <ManageStack.Screen name="ManageMain" component={ManageScreen} />
      {/* People */}
      <ManageStack.Screen name="UsersAndDoctorsMain" component={UnifiedUserDoctorScreen} />
      <ManageStack.Screen name="EditUser" component={EditUserScreen} />
      <ManageStack.Screen name="ManageRoles" component={MetadataManagementScreen} />
      <ManageStack.Screen name="DoctorDetail" component={DoctorDetailScreen} />
      <ManageStack.Screen name="EditDoctor" component={EditDoctorScreen} />
      <ManageStack.Screen name="ClinicAddressPicker" component={ClinicAddressPickerScreen} />
      <ManageStack.Screen name="ManageExpertise" component={MetadataManagementScreen} />
      <ManageStack.Screen name="ManageLanguages" component={MetadataManagementScreen} />
      <ManageStack.Screen name="ManageSpecialties" component={MetadataManagementScreen} />
      {/* Scheduling */}
      <ManageStack.Screen name="AppointmentsMain" component={AppointmentManagementScreen} />
      <ManageStack.Screen name="SlotManagement" component={SlotManagementScreen} />
      <ManageStack.Screen name="DoctorLeaveManagement" component={DoctorLeaveManagementScreen} />
      {/* Content */}
      <ManageStack.Screen name="VideoManagement" component={VideoManagementScreen} />
      <ManageStack.Screen name="VideoGroupDetail" component={VideoGroupDetailScreen} />
      <ManageStack.Screen name="VideoGroupEditor" component={VideoGroupEditorScreen} />
      <ManageStack.Screen name="UploadVideo" component={UploadVideoScreen} />
      <ManageStack.Screen name="FaqManagement" component={FaqManagementScreen} />
      <ManageStack.Screen name="NotificationAdmin" component={NotificationAdminScreen} />
      <ManageStack.Screen name="ContentManagement" component={ContentManagementScreen} />
      <ManageStack.Screen name="ContentEditor" component={ContentEditorScreen} />
      <ManageStack.Screen name="ContentDetail" component={ContentDetailScreen} />
      {/* Billing */}
      <ManageStack.Screen name="TaxSettings" component={TaxSettingsScreen} />
    </ManageStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"    component={ProfileScreen}        />
      <ProfileStack.Screen name="Settings"       component={SettingsScreen}       />
      <ProfileStack.Screen name="HelpSupport"    component={HelpSupportScreen}    />
      <ProfileStack.Screen name="ContentViewer"  component={ContentViewerScreen}  />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  // Respect the device's bottom safe area (gesture bar / home indicator) so the
  // tab bar isn't flush against the screen edge — matches the users & doctors apps.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Icon name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          paddingBottom: 2,
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeStackNavigator}    listeners={makeTabListener('Home')}    options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Manage"  component={ManageStackNavigator}  listeners={makeTabListener('Manage')}  />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} listeners={makeTabListener('Profile')} />
    </Tab.Navigator>
  );
}

// ── Minimal splash shown while bootstrap is in-flight ─────────────────────────
function SplashScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}

export default function App() {
  const [bootstrapped, setBootstrapped] = useState(false);
  // Subscribe to auth state — changes here drive the navigator re-render
  const isLoggedIn = useAuthStore((s: any) => s.isLoggedIn);
  const { message, type, visible, hide } = useToastStore();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    // Load the saved theme preference alongside the auth session.
    useThemeStore.getState().hydrate();
    (async () => {
      await authService.bootstrap();
      // If biometric login is enabled and a session was restored, require the
      // fingerprint / Face ID prompt before unlocking. Fail closed: any
      // cancellation or failure drops back to the password login screen.
      try {
        const loggedIn = useAuthStore.getState().isLoggedIn;
        if (loggedIn && (await biometricService.isEnabled())) {
          const ok = await biometricService.authenticate('Unlock Purnazen Admin');
          if (!ok) {
            await authService.logout();
          }
        }
      } catch {
        // never block app start on a biometric error
      }
      setBootstrapped(true);
      // Re-read the profile once the UI is up. The cached copy can be hours or
      // days old, and its avatar URL is a ~60-minute SAS link — without this the
      // profile photo stops loading and any change made elsewhere never lands.
      if (useAuthStore.getState().isLoggedIn) {
        authService.refreshProfile();
      }
    })();
  }, []);

  // Feed the active palette into React Navigation so inter-screen backgrounds
  // (and any default headers) follow dark mode instead of flashing white.
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
    },
  };

  if (!bootstrapped) {
    return <SplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
        onUnhandledAction={() => {}}
      >
        <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          {isLoggedIn ? (
            <RootStack.Screen name="Main" component={MainTabs} />
          ) : (
            <>
              <RootStack.Screen name="Login"    component={LoginScreen}    />
              <RootStack.Screen name="Register" component={RegisterScreen} />
            </>
          )}
        </RootStack.Navigator>
        <Toast message={message} type={type} visible={visible} onHide={hide} />
        <AppAlertHost />
        <UpdatePrompt />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
