import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
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
import DoctorManagementScreen from './src/screens/DoctorManagementScreen';
import DoctorDetailScreen from './src/screens/DoctorDetailScreen';
import EditDoctorScreen from './src/screens/EditDoctorScreen';
import MetadataManagementScreen from './src/screens/MetadataManagementScreen';
import UserManagementScreen from './src/screens/UserManagementScreen';
import EditUserScreen from './src/screens/EditUserScreen';
import ManageRolesScreen from './src/screens/ManageRolesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AppointmentManagementScreen from './src/screens/AppointmentManagementScreen';
import SlotManagementScreen from './src/screens/SlotManagementScreen';
import DoctorLeaveManagementScreen from './src/screens/DoctorLeaveManagementScreen';
import VideoManagementScreen from './src/screens/VideoManagementScreen';
import VideoGroupDetailScreen from './src/screens/VideoGroupDetailScreen';
import UploadVideoScreen from './src/screens/UploadVideoScreen';


const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const UsersStack = createNativeStackNavigator();
const AppointmentsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home:        { active: 'home',                    inactive: 'home-outline'                  },
  Users:       { active: 'account-group',           inactive: 'account-group-outline'         },
  LeaveCenter: { active: 'beach',                   inactive: 'beach'                         },
  Appointments:{ active: 'calendar-clock',          inactive: 'calendar-clock-outline'        },
  Profile:     { active: 'account-circle',          inactive: 'account-circle-outline'        },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain"        component={HomeScreen} />
      <HomeStack.Screen name="SlotManagement"  component={SlotManagementScreen} />
      <HomeStack.Screen name="DoctorLeaveManagement" component={DoctorLeaveManagementScreen} />
      <HomeStack.Screen name="VideoManagement" component={VideoManagementScreen} />
      <HomeStack.Screen name="VideoGroupDetail" component={VideoGroupDetailScreen} />
      <HomeStack.Screen name="UploadVideo"     component={UploadVideoScreen} />

    </HomeStack.Navigator>
  );
}

function UsersAndDoctorsStackNavigator() {
  return (
    <UsersStack.Navigator screenOptions={{ headerShown: false }}>
      <UsersStack.Screen name="UsersAndDoctorsMain" component={UnifiedUserDoctorScreen} />
      <UsersStack.Screen name="EditUser" component={EditUserScreen} />
      <UsersStack.Screen name="ManageRoles" component={MetadataManagementScreen} />
      <UsersStack.Screen name="DoctorDetail" component={DoctorDetailScreen} />
      <UsersStack.Screen name="EditDoctor" component={EditDoctorScreen} />
      <UsersStack.Screen name="ManageExpertise" component={MetadataManagementScreen} />
      <UsersStack.Screen name="ManageLanguages" component={MetadataManagementScreen} />
      <UsersStack.Screen name="ManageSpecialties" component={MetadataManagementScreen} />
    </UsersStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"    component={ProfileScreen}        />
      <ProfileStack.Screen name="Settings"       component={SettingsScreen}       />
    </ProfileStack.Navigator>
  );
}

function AppointmentsStackNavigator() {
  return (
    <AppointmentsStack.Navigator screenOptions={{ headerShown: false }}>
      <AppointmentsStack.Screen name="AppointmentsMain" component={AppointmentManagementScreen} />
    </AppointmentsStack.Navigator>
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
      <Tab.Screen name="Home"        component={HomeStackNavigator}    />
      <Tab.Screen name="Users"       component={UsersAndDoctorsStackNavigator} />
      <Tab.Screen name="LeaveCenter" component={DoctorLeaveManagementScreen} options={{ tabBarLabel: 'Leaves' }} />
      <Tab.Screen name="Appointments" component={AppointmentsStackNavigator} />
      <Tab.Screen name="Profile"     component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({});

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
      <NavigationContainer ref={navigationRef} theme={navTheme}>
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
