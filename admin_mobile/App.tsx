import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// @ts-ignore
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// @ts-ignore
import authService from './src/services/authService';
// @ts-ignore
import { navigationRef } from './src/navigation/navigationRef';
// @ts-ignore
import { COLORS } from './src/constants/theme';
// @ts-ignore
import Toast from './src/components/Toast';
// @ts-ignore
import useToastStore from './src/utils/toast';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
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
import VideoManagementScreen from './src/screens/VideoManagementScreen';
import VideoGroupDetailScreen from './src/screens/VideoGroupDetailScreen';
import VideoPlayerScreen from './src/screens/VideoPlayerScreen';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const DoctorsStack = createNativeStackNavigator();
const UsersStack = createNativeStackNavigator();
const AppointmentsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home:        { active: 'home',                    inactive: 'home-outline'                  },
  Doctors:     { active: 'doctor',                  inactive: 'doctor'                        },
  Users:       { active: 'account-group',           inactive: 'account-group-outline'         },
  Appointments:{ active: 'calendar-clock',          inactive: 'calendar-clock-outline'        },
  Profile:     { active: 'account-circle',          inactive: 'account-circle-outline'        },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain"        component={HomeScreen} />
      <HomeStack.Screen name="SlotManagement"  component={SlotManagementScreen} />
      <HomeStack.Screen name="VideoManagement" component={VideoManagementScreen} />
      <HomeStack.Screen name="VideoGroupDetail" component={VideoGroupDetailScreen} />
      <HomeStack.Screen name="VideoPlayer"     component={VideoPlayerScreen} />
    </HomeStack.Navigator>
  );
}

function DoctorsStackNavigator() {
  return (
    <DoctorsStack.Navigator screenOptions={{ headerShown: false }}>
      <DoctorsStack.Screen name="DoctorsMain"      component={DoctorManagementScreen} />
      <DoctorsStack.Screen name="DoctorDetail"     component={DoctorDetailScreen} />
      <DoctorsStack.Screen name="EditDoctor"       component={EditDoctorScreen} />
      <DoctorsStack.Screen name="ManageExpertise"  component={MetadataManagementScreen} />
      <DoctorsStack.Screen name="ManageLanguages"  component={MetadataManagementScreen} />
      <DoctorsStack.Screen name="ManageSpecialties" component={MetadataManagementScreen} />
    </DoctorsStack.Navigator>
  );
}

function UsersStackNavigator() {
  return (
    <UsersStack.Navigator screenOptions={{ headerShown: false }}>
      <UsersStack.Screen name="UsersMain" component={UserManagementScreen} />
      <UsersStack.Screen name="ManageRoles" component={MetadataManagementScreen} />
      <UsersStack.Screen name="EditUser" component={EditUserScreen} />
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Icon name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          height: 60,
          paddingBottom: 8,
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
        },
      })}
    >
      <Tab.Screen name="Home"        component={HomeStackNavigator}    />
      <Tab.Screen name="Doctors"     component={DoctorsStackNavigator} />
      <Tab.Screen name="Users"       component={UsersStackNavigator} />
      <Tab.Screen name="Appointments" component={AppointmentsStackNavigator} />
      <Tab.Screen name="Profile"     component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    authService.bootstrap();
  }, []);

  const { message, type, visible, hide } = useToastStore();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Login"    component={LoginScreen}    />
          <RootStack.Screen name="Register" component={RegisterScreen} />
          <RootStack.Screen name="Main"     component={MainTabs}       />
        </RootStack.Navigator>
        <Toast message={message} type={type} visible={visible} onHide={hide} />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
