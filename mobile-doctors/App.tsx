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
import UpdatePrompt from './src/components/UpdatePrompt';
// @ts-ignore
import useToastStore from './src/utils/toast';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import AppointmentDetailScreen from './src/screens/AppointmentDetailScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import PatientsScreen from './src/screens/PatientsScreen';
import PatientDetailScreen from './src/screens/PatientDetailScreen';
import PatientDetailsScreen from './src/screens/PatientDetailsScreen';
import ConsultationNotesScreen from './src/screens/ConsultationNotesScreen';
import DoctorNotesEditorScreen from './src/screens/DoctorNotesEditorScreen';
import DiagnosisEditorScreen from './src/screens/DiagnosisEditorScreen';
import PrescriptionEditorScreen from './src/screens/PrescriptionEditorScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AppointmentsStack = createNativeStackNavigator();
const PatientsStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Dashboard: { active: 'view-dashboard', inactive: 'view-dashboard-outline' },
  Appointments: { active: 'calendar-check', inactive: 'calendar-check-outline' },
  Schedule: { active: 'calendar-clock', inactive: 'calendar-clock-outline' },
  Patients: { active: 'account-multiple', inactive: 'account-multiple-outline' },
  Profile: { active: 'account-circle', inactive: 'account-circle-outline' },
};

function AppointmentsStackNavigator() {
  return (
    <AppointmentsStack.Navigator screenOptions={{ headerShown: false }}>
      <AppointmentsStack.Screen name="AppointmentsMain" component={AppointmentsScreen} />
      <AppointmentsStack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
      <AppointmentsStack.Screen name="PatientDetails" component={PatientDetailsScreen} />
      <AppointmentsStack.Screen name="ConsultationNotes" component={ConsultationNotesScreen} />
      <AppointmentsStack.Screen name="DoctorNotesEditor" component={DoctorNotesEditorScreen} />
      <AppointmentsStack.Screen name="DiagnosisEditor" component={DiagnosisEditorScreen} />
      <AppointmentsStack.Screen name="PrescriptionEditor" component={PrescriptionEditorScreen} />
    </AppointmentsStack.Navigator>
  );
}

function PatientsStackNavigator() {
  return (
    <PatientsStack.Navigator screenOptions={{ headerShown: false }}>
      <PatientsStack.Screen name="PatientsMain" component={PatientsScreen} />
      <PatientsStack.Screen name="PatientDetail" component={PatientDetailScreen} />
    </PatientsStack.Navigator>
  );
}

function MainTabs() {
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
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', paddingBottom: 2 },
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Appointments" component={AppointmentsStackNavigator} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Patients" component={PatientsStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
  const isLoggedIn = useAuthStore((s: any) => s.isLoggedIn);
  const { message, type, visible, hide } = useToastStore();

  useEffect(() => {
    authService.bootstrap().finally(() => setBootstrapped(true));
  }, []);

  if (!bootstrapped) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isLoggedIn ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
      <Toast message={message} type={type} visible={visible} onHide={hide} />
      <UpdatePrompt />
    </NavigationContainer>
  );
}
