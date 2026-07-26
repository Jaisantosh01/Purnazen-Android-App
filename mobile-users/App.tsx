import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
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
import permissionsService from './src/services/permissionsService';
// @ts-ignore
import preferencesService from './src/services/preferencesService';
// @ts-ignore
import { useAuthStore } from './src/store/authStore';
import pushService from './src/services/pushService';
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
import ErrorBoundary from './src/components/ErrorBoundary';
// @ts-ignore
import UpdatePrompt from './src/components/UpdatePrompt';
// @ts-ignore
import useToastStore from './src/utils/toast';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
// @ts-ignore
import ProfileCompletionScreen from './src/screens/ProfileCompletionScreen';
import BiometricSetupScreen from './src/screens/BiometricSetupScreen';
// @ts-ignore
import { useProfileStore } from './src/store/profileStore';
import HomeScreen from './src/screens/HomeScreen';
import ReliefScreen from './src/screens/ReliefScreen';
import WellnessScreen from './src/screens/WellnessScreen';
import ConsultScreen from './src/screens/ConsultScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TherapyHistoryScreen from './src/screens/TherapyHistoryScreen';
// @ts-ignore
import HealthReportScreen from './src/screens/HealthReportScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ContentViewerScreen from './src/screens/ContentViewerScreen';
import SubscriptionsScreen from './src/screens/SubscriptionsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NotificationCenterScreen from './src/screens/NotificationCenterScreen';
import SelectSymptomScreen from './src/screens/SelectSymptomScreen';
import FaceGlowScreen from './src/screens/FaceGlowScreen';
import FaceScanScreen from './src/screens/FaceScanScreen';
// @ts-ignore
import TongueScanScreen from './src/screens/TongueScanScreen';
import ScanProcessingScreen from './src/screens/ScanProcessingScreen';
import ScanResultsScreen from './src/screens/ScanResultsScreen';
import ScanHistoryScreen from './src/screens/ScanHistoryScreen';
import ScanDashboardScreen from './src/screens/ScanDashboardScreen';
import ScanComparisonScreen from './src/screens/ScanComparisonScreen';
import ScanErrorScreen from './src/screens/ScanErrorScreen';
import ConsentScreen from './src/screens/ConsentScreen';
import YogaSessionScreen from './src/screens/YogaSessionScreen';
import ReliefSessionScreen from './src/screens/ReliefSessionScreen';
import ChatAssistantScreen from './src/screens/ChatAssistantScreen';
import VideoPlayerScreen from './src/screens/VideoPlayerScreen';
import DoctorProfileScreen from './src/screens/DoctorProfileScreen';
import BookAppointmentScreen from './src/screens/BookAppointmentScreen';
import BookingConfirmedScreen from './src/screens/BookingConfirmedScreen';
import AppointmentHistoryScreen from './src/screens/AppointmentHistoryScreen';
import AppointmentDetailScreen from './src/screens/AppointmentDetailScreen';
import PaymentScreen from './src/screens/PaymentScreen';
// @ts-ignore
import AddressManagementScreen from './src/screens/AddressManagementScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const WellnessStack = createNativeStackNavigator();
const ReliefStack   = createNativeStackNavigator();
const ConsultStack  = createNativeStackNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home:        { active: 'home',               inactive: 'home-outline'             },
  Relief:      { active: 'heart',              inactive: 'heart-outline'            },
  WellnessTab: { active: 'star-four-points',   inactive: 'star-four-points-outline' },
  ConsultTab:  { active: 'calendar-month',     inactive: 'calendar-month-outline'   },
  Profile:     { active: 'account-circle',     inactive: 'account-circle-outline'   },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain"       component={HomeScreen}          />
      <HomeStack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
      <HomeStack.Screen name="SelectSymptom"  component={SelectSymptomScreen} />
      <HomeStack.Screen name="FaceGlow"       component={FaceGlowScreen}      />
      <HomeStack.Screen name="FaceScan"       component={FaceScanScreen}      />
      <HomeStack.Screen name="TongueScan"    component={TongueScanScreen}    />
      <HomeStack.Screen name="ScanProcessing" component={ScanProcessingScreen}/>
      <HomeStack.Screen name="ScanResults"    component={ScanResultsScreen}   />
      <HomeStack.Screen name="ScanHistory"    component={ScanHistoryScreen}   />
      <HomeStack.Screen name="ScanDashboard"  component={ScanDashboardScreen} />
      <HomeStack.Screen name="ScanComparison" component={ScanComparisonScreen}/>
      <HomeStack.Screen name="ScanError"      component={ScanErrorScreen}     />
      <HomeStack.Screen name="SessionScreen"  component={YogaSessionScreen}   />
      <HomeStack.Screen name="ReliefSession"  component={ReliefSessionScreen} />
      <HomeStack.Screen name="ChatAssistant"  component={ChatAssistantScreen} />
      <HomeStack.Screen name="VideoPlayer"    component={VideoPlayerScreen}   />
    </HomeStack.Navigator>
  );
}

function ReliefStackNavigator() {
  return (
    <ReliefStack.Navigator screenOptions={{ headerShown: false }}>
      <ReliefStack.Screen name="ReliefMain"    component={ReliefScreen}        />
      <ReliefStack.Screen name="ReliefSession" component={ReliefSessionScreen} />
      <ReliefStack.Screen name="ChatAssistant" component={ChatAssistantScreen} />
      <ReliefStack.Screen name="VideoPlayer"   component={VideoPlayerScreen}   />
    </ReliefStack.Navigator>
  );
}

function WellnessStackNavigator() {
  return (
    <WellnessStack.Navigator screenOptions={{ headerShown: false }}>
      <WellnessStack.Screen name="WellnessMain"  component={WellnessScreen}    />
      <WellnessStack.Screen name="SessionScreen" component={YogaSessionScreen} />
      <WellnessStack.Screen name="VideoPlayer"   component={VideoPlayerScreen} />
    </WellnessStack.Navigator>
  );
}

function ConsultStackNavigator() {
  return (
    <ConsultStack.Navigator screenOptions={{ headerShown: false }}>
      <ConsultStack.Screen name="ConsultMain"      component={ConsultScreen}         />
      <ConsultStack.Screen name="DoctorProfile"    component={DoctorProfileScreen}   />
      <ConsultStack.Screen name="BookAppointment"  component={BookAppointmentScreen} />
      <ConsultStack.Screen name="BookingConfirmed" component={BookingConfirmedScreen}/>
      <ConsultStack.Screen name="AppointmentHistory" component={AppointmentHistoryScreen} />
      <ConsultStack.Screen name="AppointmentDetail"  component={AppointmentDetailScreen}  />
      <ConsultStack.Screen name="Payment"          component={PaymentScreen}         />
      <ConsultStack.Screen name="AddressManagement" component={AddressManagementScreen} />
    </ConsultStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"    component={ProfileScreen}        />
      <ProfileStack.Screen name="AppointmentHistory" component={AppointmentHistoryScreen} />
      <ProfileStack.Screen name="AppointmentDetail"  component={AppointmentDetailScreen}  />
      <ProfileStack.Screen name="TherapyHistory" component={TherapyHistoryScreen} />
      <ProfileStack.Screen name="HealthReport"   component={HealthReportScreen}   />
      <ProfileStack.Screen name="VideoPlayer"    component={VideoPlayerScreen}    />
      <ProfileStack.Screen name="ReliefSession"  component={ReliefSessionScreen}  />
      <ProfileStack.Screen name="HelpSupport"    component={HelpSupportScreen}    />
      <ProfileStack.Screen name="Settings"       component={SettingsScreen}       />
      <ProfileStack.Screen name="Consent"        component={ConsentScreen}        />
      <ProfileStack.Screen name="Subscriptions"  component={SubscriptionsScreen}  />
      <ProfileStack.Screen name="Notifications"  component={NotificationsScreen}  />
      <ProfileStack.Screen name="AddressManagement" component={AddressManagementScreen} />
      <ProfileStack.Screen name="ContentViewer" component={ContentViewerScreen} />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  // Respect the device's bottom safe area (gesture bar / home indicator) so the
  // tab bar isn't flush against the screen edge. Floor of 10 keeps a comfortable
  // gap on devices that report no inset.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return <Icon name={focused ? icons.active : icons.inactive} size={22} color={color} />;
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
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', paddingBottom: 2 },
      })}
    >
      <Tab.Screen name="Home"        component={HomeStackNavigator}    />
      <Tab.Screen name="Relief"      component={ReliefStackNavigator}  />
      <Tab.Screen
        name="WellnessTab"
        component={WellnessStackNavigator}
        options={{ tabBarLabel: 'Wellness' }}
      />
      <Tab.Screen
        name="ConsultTab"
        component={ConsultStackNavigator}
        options={{ tabBarLabel: 'Consult' }}
      />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
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
  // Subscribe to auth state — changes here drive navigator re-render
  const isLoggedIn = useAuthStore((s: any) => s.isLoggedIn);

  // Register / release this device for push when auth state flips.
  useEffect(() => {
    if (isLoggedIn) {
      pushService.init();
    } else {
      pushService.unregister();
    }
  }, [isLoggedIn]);
  const needsProfile = useProfileStore((s: any) => s.pendingCompletion);
  const needsBiometric = useProfileStore((s: any) => s.pendingBiometricSetup);
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
          const ok = await biometricService.authenticate('Unlock Purnazen');
          if (!ok) {
            await authService.logout();
          }
        }
      } catch {
        // never block app start on a biometric error
      }
      setBootstrapped(true);
    })();
  }, []);

  // One-time permission onboarding: after the user is in the app (and past the
  // profile-completion step), request mandatory + optional permissions once and
  // mirror the location grant into server preferences so it syncs across devices.
  useEffect(() => {
    if (!isLoggedIn || needsProfile || needsBiometric) return;
    (async () => {
      try {
        const result: any = await permissionsService.ensureRequested();
        if (result) {
          await preferencesService
            .updatePreferences({ locationEnabled: !!result.location })
            .catch(() => {});
        }
      } catch {
        // never block the app on a permission flow
      }
    })();
  }, [isLoggedIn, needsProfile, needsBiometric]);

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
    <ErrorBoundary screen="App">
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isLoggedIn ? (
          // ── Authenticated routes ─────────────────────────────────────────
          // One-time post-sign-up profile completion gates the main tabs.
          needsProfile ? (
            <RootStack.Screen name="ProfileCompletion" component={ProfileCompletionScreen} />
          ) : needsBiometric ? (
            <RootStack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
          ) : (
            <RootStack.Screen name="Main" component={MainTabs} />
          )
        ) : (
          // ── Unauthenticated routes ───────────────────────────────────────
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
    </ErrorBoundary>
  );
}
