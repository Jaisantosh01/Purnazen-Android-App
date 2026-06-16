import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// @ts-ignore
import authService from './src/services/authService';
// @ts-ignore
import { useAuthStore } from './src/store/authStore';
// @ts-ignore
import { navigationRef } from './src/navigation/navigationRef';
// @ts-ignore
import { COLORS } from './src/constants/theme';
// @ts-ignore
import Toast from './src/components/Toast';
// @ts-ignore
import ErrorBoundary from './src/components/ErrorBoundary';
// @ts-ignore
import useToastStore from './src/utils/toast';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ReliefScreen from './src/screens/ReliefScreen';
import WellnessScreen from './src/screens/WellnessScreen';
import ConsultScreen from './src/screens/ConsultScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TherapyHistoryScreen from './src/screens/TherapyHistoryScreen';
import HelpSupportScreen from './src/screens/HelpSupportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SubscriptionsScreen from './src/screens/SubscriptionsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
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
import DoctorProfileScreen from './src/screens/DoctorProfileScreen';
import BookAppointmentScreen from './src/screens/BookAppointmentScreen';
import BookingConfirmedScreen from './src/screens/BookingConfirmedScreen';
import PaymentScreen from './src/screens/PaymentScreen';

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
    </HomeStack.Navigator>
  );
}

function ReliefStackNavigator() {
  return (
    <ReliefStack.Navigator screenOptions={{ headerShown: false }}>
      <ReliefStack.Screen name="ReliefMain"    component={ReliefScreen}        />
      <ReliefStack.Screen name="ReliefSession" component={ReliefSessionScreen} />
    </ReliefStack.Navigator>
  );
}

function WellnessStackNavigator() {
  return (
    <WellnessStack.Navigator screenOptions={{ headerShown: false }}>
      <WellnessStack.Screen name="WellnessMain"  component={WellnessScreen}    />
      <WellnessStack.Screen name="SessionScreen" component={YogaSessionScreen} />
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
      <ConsultStack.Screen name="Payment"          component={PaymentScreen}         />
    </ConsultStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"    component={ProfileScreen}        />
      <ProfileStack.Screen name="TherapyHistory" component={TherapyHistoryScreen} />
      <ProfileStack.Screen name="HelpSupport"    component={HelpSupportScreen}    />
      <ProfileStack.Screen name="Settings"       component={SettingsScreen}       />
      <ProfileStack.Screen name="Consent"        component={ConsentScreen}        />
      <ProfileStack.Screen name="Subscriptions"  component={SubscriptionsScreen}  />
      <ProfileStack.Screen name="Notifications"  component={NotificationsScreen}  />
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  // Respect the device's bottom safe area (gesture bar / home indicator) so the
  // tab bar isn't flush against the screen edge. Floor of 10 keeps a comfortable
  // gap on devices that report no inset.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return <Icon name={focused ? icons.active : icons.inactive} size={22} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
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
  const { message, type, visible, hide } = useToastStore();

  useEffect(() => {
    authService.bootstrap().finally(() => setBootstrapped(true));
  }, []);

  if (!bootstrapped) {
    return <SplashScreen />;
  }

  return (
    <ErrorBoundary screen="App">
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isLoggedIn ? (
          // ── Authenticated routes ─────────────────────────────────────────
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          // ── Unauthenticated routes ───────────────────────────────────────
          <>
            <RootStack.Screen name="Login"    component={LoginScreen}    />
            <RootStack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </RootStack.Navigator>
      <Toast message={message} type={type} visible={visible} onHide={hide} />
    </NavigationContainer>
    </ErrorBoundary>
  );
}
